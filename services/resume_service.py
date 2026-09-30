import io
import re

from werkzeug.utils import secure_filename

from services.career_service import _load_json, _matches, role_profile
from services.gemini_service import AI_UNAVAILABLE_MESSAGE, generate_json

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
MAX_RESUME_BYTES = 5 * 1024 * 1024


class ResumeInputError(ValueError):
    """Expected user-facing resume validation or parsing error."""


def extract_resume_text(upload):
    safe_name = secure_filename(upload.filename or "")
    extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise ResumeInputError("Unsupported format. Upload a PDF, DOCX, or TXT resume.")
    content = upload.read(MAX_RESUME_BYTES + 1)
    if not content:
        raise ResumeInputError("The selected resume is empty.")
    if len(content) > MAX_RESUME_BYTES:
        raise ResumeInputError("Please upload a file smaller than 5 MB.")
    try:
        if extension == "txt":
            text = content.decode("utf-8-sig")
        elif extension == "pdf":
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content), strict=False)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            from docx import Document

            document = Document(io.BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    except Exception as error:
        raise ResumeInputError("We could not read this resume. Try a text-based PDF, DOCX, or TXT file.") from error
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 20:
        raise ResumeInputError("We could not find enough readable text in this resume.")
    return text[:30000]


def analyze_resume(upload, target_role):
    text = extract_resume_text(upload)
    profile = role_profile(target_role)
    known_skills = []
    for role in _load_json("roles.json"):
        known_skills.extend(role["skills"])
    known_skills = list(dict.fromkeys(known_skills))
    found = [skill for skill in known_skills if re.search(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", text, re.IGNORECASE)]
    required = profile["skills"]
    matching = _matches(required, found)
    missing = [skill for skill in required if skill not in matching]
    weak = [
        skill for skill in matching
        if len(re.findall(r"(?<!\w)" + re.escape(skill) + r"(?!\w)", text, re.IGNORECASE)) == 1
    ]
    score = round(len(matching) / max(len(required), 1) * 100)
    prompt = (
        f"Analyze this resume for target role {target_role}. Resume text: {text[:10000]}. "
        "Return JSON with improvement_areas (array), certifications (array), keywords (array), score_factors (array of short explanations). "
        "Do not claim the score is official; avoid inventing experience."
    )
    ai = generate_json(prompt)
    portals_data = _load_json("job_portals.json")
    portals = [portal for portal in portals_data if any(term.casefold() in target_role.casefold() for term in portal["roles"])]
    if not portals:
        portals = portals_data[:3]
    return {
        "target_role": target_role,
        "resume_skills": found,
        "matching_skills": matching,
        "missing_skills": missing,
        "weak_skills": weak,
        "compatibility_score": score,
        "score_label": "Estimated resume compatibility",
        "score_factors": (ai or {}).get("score_factors") or [
            f"{len(matching)} of {len(required)} role skills were found in the resume text.",
            "This estimate checks skill keyword coverage, not experience quality or an employer's ATS rules.",
            "Clear evidence and measurable outcomes can improve a human review.",
        ],
        "improvement_areas": (ai or {}).get("improvement_areas") or ["Add measurable outcomes to experience bullets.", "Make relevant projects and your personal contribution easy to scan.", "Use a concise skills section with role-relevant terms."],
        "certifications": (ai or {}).get("certifications") or ["Choose one recognized, role-relevant course certificate and pair it with a practical project."],
        "keywords": (ai or {}).get("keywords") or required,
        "job_portals": portals,
        "ai_notice": None if ai else AI_UNAVAILABLE_MESSAGE,
    }