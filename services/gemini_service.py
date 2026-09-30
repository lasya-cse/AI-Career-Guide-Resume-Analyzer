import json
import logging
import os
import re
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)
AI_UNAVAILABLE_MESSAGE = "Right now, we could not generate the output. Please try again."
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def generate_json(prompt):
    """Ask Gemini for JSON and return None for any external/API failure."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_api_key_here":
        return None

    request_body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
    }
    request_url = f"{GEMINI_URL}?key={api_key}"
    api_request = urllib.request.Request(
        request_url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(api_request, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        return _decode_json(text)
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError) as error:
        logger.warning("Gemini request did not return usable output: %s", type(error).__name__)
        return None


def _decode_json(text):
    if not isinstance(text, str) or not text.strip():
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None