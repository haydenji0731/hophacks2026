import os
import json
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv

    # Repo root is backend/detector/ -> parents[2]
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass

API_URL = "https://api.x.ai/v1/chat/completions"


def _api_key() -> str:
    """Read the key at call time so importing this module never fails."""
    key = os.environ.get("XAI_API_KEY")
    if not key:
        raise RuntimeError("XAI_API_KEY is not set. Add it to the repo-root .env file.")
    return key


# ---------------------------------------------------------------------------
# STEP 1: Fixed, hardcoded early questions.
# Fast, reliable, zero API cost, never fails during a demo.
# Adjust/extend these branches as needed.
# ---------------------------------------------------------------------------

FIXED_QUESTIONS = [
    {
        "id": "channel",
        "question": "How did this happen?",
        "options": ["Phone call", "Text message", "Email", "Social media", "In person", "Other"],
    },
    {
        "id": "ask",
        "question": "What did they ask you to do?",
        "options": [
            "Send money or gift cards",
            "Share a code or password",
            "Click a link",
            "Stay on the phone / follow instructions",
            "Give personal information",
            "Nothing yet / just suspicious",
            "Other",
        ],
    },
    {
        "id": "urgency",
        "question": "Did they pressure you to act quickly or create a sense of urgency?",
        "options": ["Yes", "No", "Not sure"],
    },
    {
        "id": "secrecy",
        "question": "Did they ask you to keep this from someone (family, bank, police)?",
        "options": ["Yes", "No", "Not sure"],
    },
]


def run_fixed_questions(answer_fn) -> dict:
    """
    Runs the fixed question set. `answer_fn` is a function that takes a
    question dict and returns the user's chosen answer as a string.
    Swap this out for however your frontend collects answers (CLI input,
    API request body, etc).
    """
    answers = {}
    for q in FIXED_QUESTIONS:
        answers[q["id"]] = answer_fn(q)
    return answers


# ---------------------------------------------------------------------------
# STEP 2: Free-text extraction via Grok.
# Takes the fixed answers + a freeform description, and extracts a
# structured scam report -- reuses the same JSON pipeline pattern as
# detect_scam.py.
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are helping build a public scam database. A user has answered
some structured questions and then described, in their own words, a scenario they think
might be a scam. Your job is to extract a clean, structured report from all of this.

PRIVACY: the output is published publicly. Never include names, phone numbers, email
addresses, street addresses, account or card numbers, or any other personal information
in ANY field. Describe people by role only (e.g. "the caller", "a family member").

Respond with ONLY a valid JSON object, no markdown formatting, no extra text.
The JSON must have exactly these fields:
{
  "is_likely_scam": true or false,
  "scam_type": "best-guess category name, e.g. 'tech support scam', 'romance scam', 'grandparent scam', or 'unclear' if not enough info",
  "confidence": a number from 0.0 to 1.0,
  "method": "how the scammer approached and what they asked for, in a short phrase",
  "target": "who this appears to target, based on context (e.g. 'elderly individual', 'general consumer', 'unclear')",
  "novel_pattern": true or false,
  "summary": "a 2-3 sentence neutral summary of what happened, written for other users to learn from",
  "reasoning": "one to two sentences on why you classified it this way"
}
(novel_pattern is true if this describes a tactic/approach that seems distinct from common well-known scam types.)
"""


def parse_json_response(raw_text: str) -> dict:
    """Parse Grok's reply, tolerating a ```json ... ``` fence around the object."""
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        cleaned = raw_text.strip()
        cleaned = cleaned.removeprefix("```json").removeprefix("```")
        cleaned = cleaned.removesuffix("```").strip()
        return json.loads(cleaned)


def extract_scam_report(fixed_answers: dict, free_text: str) -> dict:
    user_content = f"""Structured answers:
{json.dumps(fixed_answers, indent=2)}

User's own description of what happened:
\"\"\"{free_text}\"\"\"
"""

    payload = {
        "model": "grok-4",
        "messages": [
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=30)

    if response.status_code != 200:
        print("ERROR RESPONSE FROM GROK:")
        print(response.text)
        response.raise_for_status()

    data = response.json()
    result = parse_json_response(data["choices"][0]["message"]["content"])

    result["fixed_answers"] = fixed_answers
    # NOTE: the user's raw free text is deliberately NOT copied into the result,
    # so it can't be written to the public database by accident.
    return result


# ---------------------------------------------------------------------------
# DEMO / TEST: simulates a survey using hardcoded answers instead of real
# user input. Swap `simulated_answer_fn` for a real frontend/CLI input
# function when wiring this into the actual product.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Simulated answers for testing -- replace with real input collection later
    simulated_answers_queue = iter([
        "Phone call",
        "Send money or gift cards",
        "Yes",
        "Yes",
    ])

    def simulated_answer_fn(question):
        answer = next(simulated_answers_queue)
        print(f"{question['question']} -> {answer}")
        return answer

    print("--- Running fixed questions ---")
    fixed_answers = run_fixed_questions(simulated_answer_fn)

    free_text_description = """Someone called claiming to be my nephew. He sounded
    upset and said he was in a hospital in another state after a car accident and
    needed money for medical bills immediately. He asked me not to call his parents
    because he was embarrassed. He wanted me to wire money through a service I'd
    never heard of, not a normal bank transfer."""

    print("\n--- Extracting structured report from free text ---")
    report = extract_scam_report(fixed_answers, free_text_description)
    print(json.dumps(report, indent=2))
