import json
import logging
from pathlib import Path

from services.gemini_service import AI_UNAVAILABLE_MESSAGE, generate_json

logger = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(filename):
    with (DATA_DIR / filename).open(encoding="utf-8") as data_file:
        return json.load(data_file)


def get_role_names():
    return [role["title"] for role in _load_json("roles.json")]


def role_profile(target_role):
    roles = _load_json("roles.json")
    normalized = target_role.casefold()
    for role in roles:
        if normalized in role["title"].casefold() or role["title"].casefold() in normalized:
            return role
    return {
        "title": target_role,
        "skills": ["Communication", "Problem solving", "Teamwork", "Role-specific fundamentals"],
        "sequence": ["Role-specific fundamentals", "Build a small project", "Practice explaining your work"],
    }


def parse_skills(value):
    if isinstance(value, list):
        items = value
    else:
        items = str(value or "").replace(";", ",").replace("\n", ",").split(",")
    seen = set()
    result = []
    for item in items:
        skill = str(item).strip()
        key = skill.casefold()
        if skill and key not in seen:
            seen.add(key)
            result.append(skill)
    return result


def _matches(required, supplied):
    supplied_text = " ".join(supplied).casefold()
    return [skill for skill in required if skill.casefold() in supplied_text]


def build_career_guide(name, target_role, current_skills):
    profile = role_profile(target_role)
    skills = parse_skills(current_skills)
    required = profile["skills"]
    matching = _matches(required, skills)
    missing = [skill for skill in required if skill not in matching]
    priorities = [
        {"skill": skill, "priority": "High" if index < 2 else "Medium", "reason": "Builds a foundation for the target role."}
        for index, skill in enumerate(missing)
    ]
    sequence = profile.get("sequence", required)
    plan = _build_30_day_plan(missing or required)
    ai_notice = None
    ai_result = generate_json(
        "Create a practical 30-day study plan for a student named " + name + " targeting " + target_role
        + ". Current skills: " + ", ".join(skills) + ". Return JSON with key 'plan', an array of exactly 30 objects: day, topic, task, resource_title, resource_url. "
        "Keep tasks beginner-friendly and URLs to reputable public learning resources."
    )
    if isinstance(ai_result, dict) and isinstance(ai_result.get("plan"), list) and len(ai_result["plan"]) >= 7:
        plan = ai_result["plan"][:30]
    elif ai_result is None:
        ai_notice = AI_UNAVAILABLE_MESSAGE

    return {
        "name": name,
        "target_role": target_role,
        "current_skills": skills,
        "matching_skills": matching,
        "missing_skills": missing,
        "priorities": priorities,
        "dependency_sequence": sequence,
        "plan": plan,
        "skill_coverage": round(len(matching) / max(len(required), 1) * 100),
        "ai_notice": ai_notice,
    }


def _build_30_day_plan(skills):
    resources = _load_json("resources.json")
    result = []
    for day in range(1, 31):
        skill = skills[(day - 1) % len(skills)]
        resource = next((item for item in resources if skill.casefold() in item["skill"].casefold()), resources[0])
        stage = "Learn" if day <= 10 else "Practice" if day <= 20 else "Build and review"
        result.append({
            "day": day,
            "topic": f"{stage}: {skill}",
            "task": f"Spend 30-45 minutes on {skill}; create a short note or working example for your portfolio.",
            "resource_title": resource["title"],
            "resource_url": resource["url"],
        })
    return result


def make_skill_challenge(skill, target_role=""):
    prompt = f"Create one concise educational coding or practical challenge for {skill}, relevant to {target_role}. Return JSON with challenge and success_criteria array."
    response = generate_json(prompt)
    if response and isinstance(response.get("challenge"), str):
        return {"skill": skill, "challenge": response["challenge"], "success_criteria": response.get("success_criteria", []), "ai_notice": None}
    defaults = {
        "flask": "Create a Flask endpoint that accepts a name and returns a JSON greeting.",
        "python": "Write a function that reads a list of records, validates required fields, and returns a summary.",
        "sql": "Design a small schema for courses and enrollments, then write a query for each course's enrollment count.",
        "javascript": "Build a form that validates input and adds submitted items to a list without reloading the page.",
    }
    return {
        "skill": skill,
        "challenge": defaults.get(skill.casefold(), f"Create a small, documented example that demonstrates {skill} in a {target_role or 'professional'} context."),
        "success_criteria": ["Meets the stated requirements", "Uses clear naming and structure", "Explains one design choice"],
        "ai_notice": AI_UNAVAILABLE_MESSAGE,
    }


def review_skill_solution(skill, challenge, solution):
    response = generate_json(
        f"Evaluate this educational submission for skill {skill}. Challenge: {challenge}. Submission: {solution}. "
        "Return JSON with demonstrated (boolean), correctness, concept_understanding, code_quality, missing_requirements array, improvement_suggestions array, feedback string. Be constructive; do not claim certification."
    )
    if response and isinstance(response.get("demonstrated"), bool):
        response["label"] = "Demonstrated" if response["demonstrated"] else "Needs Improvement"
        response["disclaimer"] = "Educational AI evaluation only; not an official certification."
        return response
    return {
        "demonstrated": False,
        "label": "Needs Improvement",
        "correctness": "An AI review is unavailable right now, so this submission has not been verified.",
        "concept_understanding": "Review the challenge requirements and explain how your solution addresses each one.",
        "code_quality": "Check naming, readability, and error handling.",
        "missing_requirements": [],
        "improvement_suggestions": ["Try again when AI review is available, or ask an instructor to review your work."],
        "feedback": "Your work was received, but it could not be evaluated at this time.",
        "disclaimer": "Educational AI evaluation only; not an official certification.",
        "ai_notice": AI_UNAVAILABLE_MESSAGE,
    }


def generate_projects(target_role, skills, missing_skills):
    current = parse_skills(skills)
    gaps = parse_skills(missing_skills)
    response = generate_json(
        f"Create 3 achievable portfolio projects for target role {target_role}. Current skills: {current}. Missing skills to prioritize: {gaps}. "
        "Return JSON with projects array; each project has title, problem, technologies array, skills array, role_value, steps array."
    )
    projects = response.get("projects") if response else None
    if not isinstance(projects, list) or len(projects) < 2:
        focus = gaps[:2] or current[:2] or ["role fundamentals"]
        projects = [
            {
                "title": f"{focus[0]} Practice Portfolio",
                "problem": f"Help a small organization solve a realistic problem using {focus[0]}.",
                "technologies": current[:3] + focus,
                "skills": focus,
                "role_value": f"Shows practical progress toward a {target_role} role.",
                "steps": ["Define one user problem", "Build a small working solution", "Add tests and a README", "Publish a demo and reflect on tradeoffs"],
            },
            {
                "title": f"{target_role} Workflow Tool",
                "problem": "Turn a repetitive workflow into a useful, measurable tool.",
                "technologies": current[:3] or focus,
                "skills": focus,
                "role_value": "Demonstrates problem solving and clear communication of technical choices.",
                "steps": ["Interview one potential user", "Sketch the workflow", "Implement a first version", "Test it and document what you learned"],
            },
        ]
    return {"projects": projects[:3], "ai_notice": None if response else AI_UNAVAILABLE_MESSAGE}


def generate_interview_questions(target_role, skills, missing_skills, resume_text=""):
    response = generate_json(
        f"Create interview practice questions for {target_role}. Skills: {skills}. Skill gaps: {missing_skills}. Resume context: {resume_text}. "
        "Return JSON with questions array (6 items), each with category (Technical, Resume, Project, or HR), question, and focus."
    )
    questions = response.get("questions") if response else None
    if not isinstance(questions, list) or not questions:
        questions = [
            {"category": "Technical", "question": f"How would you use {parse_skills(skills)[0] if parse_skills(skills) else 'your core skills'} to solve a problem in this role?", "focus": "Explain your reasoning and tradeoffs."},
            {"category": "Technical", "question": f"What are you currently learning to strengthen your {target_role} skills?", "focus": "Show a concrete learning plan."},
            {"category": "Resume", "question": "Which experience best demonstrates your ability to learn and deliver?", "focus": "Use a specific example and outcome."},
            {"category": "Project", "question": "Describe a project you built, the hardest decision, and what you would improve.", "focus": "Be clear about your individual contribution."},
            {"category": "HR", "question": "Tell me about yourself and why this role interests you.", "focus": "Connect your interests to the role."},
            {"category": "HR", "question": "Tell me about a time you received feedback and acted on it.", "focus": "Use a concise situation, action, result structure."},
        ]
    return {"questions": questions[:8], "ai_notice": None if response else AI_UNAVAILABLE_MESSAGE}


def review_answer(question, answer):
    response = generate_json(f"Give concise constructive feedback on an interview answer. Question: {question}. Answer: {answer}. Return JSON with strengths array, improvements array, sample_tip string, rating_out_of_5 integer.")
    if response:
        return {**response, "ai_notice": None}
    return {
        "strengths": ["You have a draft answer to build on."],
        "improvements": ["Add a specific example and explain the result."],
        "sample_tip": "Use a short situation, action, and result structure.",
        "rating_out_of_5": 0,
        "ai_notice": AI_UNAVAILABLE_MESSAGE,
    }