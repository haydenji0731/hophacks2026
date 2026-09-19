import os
import json
import requests

API_KEY = os.environ.get("XAI_API_KEY")
API_URL = "https://api.x.ai/v1/chat/completions"

# ---------------------------------------------------------------------------
# STEP 1: Branching questions.
# Q1 picks the channel. Q2+ change based on that answer, so the questions
# actually feel relevant instead of generic. No API calls here -- fast,
# free, and never breaks live.
# ---------------------------------------------------------------------------

CHANNEL_QUESTION = {
    "id": "channel",
    "question": "How did this happen?",
    "options": ["Phone call", "Text message", "Email", "Link or website", "Social media", "In person", "Other"],
}

# Follow-up questions per channel. Each list runs in order after the channel
# question. Keep these short -- 2-3 max per branch so the flow stays fast.
CHANNEL_FOLLOWUPS = {
    "Phone call": [
        {
            "id": "caller_claim",
            "question": "Who did the caller claim to be?",
            "options": ["A family member", "A bank or company", "Government/police/IRS", "Tech support", "Unknown/didn't say", "Other"],
        },
        {
            "id": "voice_quality",
            "question": "Did the voice sound natural, or off in any way (robotic, choppy, unnatural pauses)?",
            "options": ["Sounded normal", "Sounded a bit off", "Sounded clearly artificial", "Not sure"],
        },
    ],
    "Text message": [
        {
            "id": "text_sender",
            "question": "Who did the text claim to be from?",
            "options": ["A bank or company", "Delivery service", "Government agency", "Unknown number", "A contact you know", "Other"],
        },
        {
            "id": "text_link",
            "question": "Did it include a link?",
            "options": ["Yes", "No"],
        },
    ],
    "Email": [
        {
            "id": "email_sender",
            "question": "Who did the email claim to be from?",
            "options": ["A bank or company", "Government agency", "Employer/coworker", "Unknown sender", "Other"],
        },
        {
            "id": "email_link",
            "question": "Did it ask you to click a link or open an attachment?",
            "options": ["Yes", "No"],
        },
    ],
    "Link or website": [
        {
            "id": "site_purpose",
            "question": "What did the site ask you to do?",
            "options": ["Log in with your credentials", "Enter payment info", "Download something", "Just looked suspicious", "Other"],
        },
    ],
    "Social media": [
        {
            "id": "social_context",
            "question": "How did they contact you?",
            "options": ["Direct message from a stranger", "Comment on a post", "Fake profile of someone you know", "An ad", "Other"],
        },
    ],
    "In person": [
        {
            "id": "person_claim",
            "question": "Who did they claim to be?",
            "options": ["Utility/service worker", "Law enforcement", "Salesperson", "Unknown", "Other"],
        },
    ],
    "Other": [],
}

# These run for every channel, after the branch-specific ones.
COMMON_FOLLOWUPS = [
    {
        "id": "ask",
        "question": "What did they ask you to do?",
        "options": [
            "Send money or gift cards",
            "Share a password or code",
            "Give personal/financial info",
            "Click a link or download something",
            "Nothing yet, just seemed off",
            "Other",
        ],
    },
    {
        "id": "urgency",
        "question": "Did they pressure you to act quickly?",
        "options": ["Yes", "No", "Not sure"],
    },
    {
        "id": "secrecy",
        "question": "Did they ask you to keep this from someone (family, bank, police)?",
        "options": ["Yes", "No", "Not sure"],
    },
]


def build_question_flow(channel: str) -> list[dict]:
    """Returns the ordered list of questions to ask, based on the channel chosen."""
    return CHANNEL_FOLLOWUPS.get(channel, []) + COMMON_FOLLOWUPS


def run_questionnaire(answer_fn) -> dict:
    """
    Runs the full branching questionnaire. `answer_fn` takes a question dict
    and returns the user's answer as a string. Swap this for real frontend
    input when wiring into the product.
    """
    answers = {}
    channel = answer_fn(CHANNEL_QUESTION)
    answers["channel"] = channel

    for q in build_question_flow(channel):
        answers[q["id"]] = answer_fn(q)

    return answers


# ---------------------------------------------------------------------------
# STEP 2: Final AI verdict.
# Takes all structured answers + optional free text, and returns a tiered
# likelihood judgment plus tailored protective steps -- not just true/false.
# ---------------------------------------------------------------------------

VERDICT_PROMPT = """You are a scam-likelihood assessor helping someone understand whether
what they experienced was likely a scam, and what they should do about it.

You will receive structured answers from a branching questionnaire, plus an optional
free-text description in the user's own words.

Judge the likelihood using this tier system (do not use plain true/false):
- "highly_likely": strong, multiple red flags, matches a known scam pattern clearly
- "possibly": some concerning signs but not conclusive, or missing key details
- "unlikely": answers describe a normal, explainable interaction with no real red flags

Even for "unlikely", include general caution tips if there's any ambiguity at all --
never tell someone with certainty that something is 100% safe.

Respond with ONLY a valid JSON object, no markdown formatting, no extra text.
The JSON must have exactly these fields:
{
  "likelihood": "highly_likely" or "possibly" or "unlikely",
  "confidence": a number from 0.0 to 1.0,
  "scam_type": "best-guess category name, or 'none identified' if unlikely",
  "method": "how the scammer approached and what they wanted, or 'none' if unlikely",
  "reasoning": "two to three sentences explaining the judgment, referencing specific answers",
  "protective_steps": [
    "a list of 3 to 5 concrete, specific actions the person should take right now,
     tailored to this exact scenario -- not generic advice. Examples of the KIND of
     specificity wanted: 'Do not send any payment through [method they mentioned]',
     'Call [the company/person] directly using a number from their official website,
     not any number given to you in this interaction', 'Report this to [specific
     relevant agency, e.g. FTC.gov, your bank's fraud line, IC3.gov]'"
  ]
}
"""


def get_verdict(answers: dict, free_text: str = "") -> dict:
    user_content = f"""Structured answers from questionnaire:
{json.dumps(answers, indent=2)}
"""
    if free_text.strip():
        user_content += f"""
Free-text description in their own words:
\"\"\"{free_text}\"\"\"
"""

    payload = {
        "model": "grok-4",
        "messages": [
            {"role": "system", "content": VERDICT_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.post(API_URL, headers=headers, json=payload, timeout=30)

    if response.status_code != 200:
        print("ERROR RESPONSE FROM GROK:")
        print(response.text)
        response.raise_for_status()

    data = response.json()
    raw_text = data["choices"][0]["message"]["content"]

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        cleaned = raw_text.strip().strip("```json").strip("```").strip()
        result = json.loads(cleaned)

    result["answers"] = answers
    result["free_text"] = free_text
    return result


# ---------------------------------------------------------------------------
# DEMO / TEST
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Simulated answers for testing -- replace answer_fn with real
    # frontend/CLI input collection when wiring into the product.
    simulated = iter([
        "Phone call",              # channel
        "A family member",         # caller_claim
        "Sounded a bit off",       # voice_quality
        "Send money or gift cards",# ask
        "Yes",                     # urgency
        "Yes",                     # secrecy
    ])

    def simulated_answer_fn(question):
        answer = next(simulated)
        print(f"{question['question']} -> {answer}")
        return answer

    print("--- Running questionnaire ---")
    answers = run_questionnaire(simulated_answer_fn)

    free_text = """Someone called claiming to be my grandson. Said he was in an
    accident and in jail, needed bail money right away, and begged me not to
    tell his parents. Wanted me to buy gift cards and read him the codes."""

    print("\n--- Getting verdict ---")
    result = get_verdict(answers, free_text)
    print(json.dumps(result, indent=2))
