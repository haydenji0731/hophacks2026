import os
import json
from pathlib import Path

import requests

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass

API_KEY = os.environ.get("XAI_API_KEY")
API_URL = "https://api.x.ai/v1/chat/completions"

SYSTEM_PROMPT = """You are a scam detection classifier. You will be given a transcript
of a phone call or conversation. Analyze it for common scam patterns, including:
- Urgency/pressure tactics ("act now", "your account will be closed")
- Requests for payment via gift cards, wire transfer, or crypto
- Impersonation of government, banks, tech support, or family members
- Requests to keep the call secret from family/friends
- Too-good-to-be-true offers (prizes, inheritance, lottery)
- Requests for personal info (SSN, passwords, OTP codes)

Respond with ONLY a valid JSON object, no markdown formatting, no extra text.
The JSON must have exactly these fields:
{
    "is_scam": true or false,
    "scam_type": "string describing the type, or 'none' if not a scam",
    "confidence": a number from 0.0 to 1.0,
    "reasoning": "one to two sentence explanation",
    "method": "how the scammer is executing the scam (e.g. 'phone impersonation', 'gift card payment request', 'phishing link', 'wire transfer request'), or 'none' if not a scam",
    "target": "who the scam appears to be targeting based on context clues in the language used (e.g. 'elderly individual', 'general consumer', 'small business owner', 'employee'), or 'unclear' if not determinable",
    "ai_generated": true, false, or "unknown" — whether the speech/message appears AI-generated (synthetic voice or clearly LLM-written script). Use "unknown" if you cannot tell from the transcript alone.
}
"""

def detect_scam(transcript):
    payload = {
        "model": "grok-4",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
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

    return result


if __name__ == "__main__":
    test_transcripts = [
        """Hi grandma, it's me, I'm in trouble. I got in a car accident and I'm
        at the police station. Please don't tell mom and dad. I need you to buy
        $500 in Google Play gift cards and read me the codes so I can pay bail.""",

        """Hello, this is calling regarding your car's extended warranty. It's
        about to expire and we wanted to give you a final chance to renew before
        your coverage lapses.""",

        """Hey, it's Sarah from the dentist's office confirming your appointment
        tomorrow at 2pm. Let us know if you need to reschedule.""",
    ]

    for i, t in enumerate(test_transcripts, 1):
        print(f"\n--- Transcript {i} ---")
        result = detect_scam(t)
        print(json.dumps(result, indent=2))