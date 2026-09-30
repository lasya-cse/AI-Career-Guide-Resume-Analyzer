import logging
import os
import secrets

from flask import Flask, jsonify, render_template, request, session
from werkzeug.exceptions import RequestEntityTooLarge

from services.career_service import (
    build_career_guide,
    generate_interview_questions,
    generate_projects,
    make_skill_challenge,
    review_answer,
    review_skill_solution,
)
from services.gemini_service import AI_UNAVAILABLE_MESSAGE
from services.resume_service import analyze_resume, ResumeInputError


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
    app.config["JSON_SORT_KEYS"] = False
    logging.basicConfig(level=logging.INFO)

    @app.errorhandler(RequestEntityTooLarge)
    def file_too_large(_error):
        return jsonify({"error": "Please upload a file smaller than 5 MB."}), 413

    @app.errorhandler(400)
    def bad_request(_error):
        return jsonify({"error": "Please check your input and try again."}), 400

    @app.errorhandler(500)
    def unexpected_error(error):
        app.logger.error("Request failed: %s", error)
        return jsonify({"error": "Something went wrong. Please try again."}), 500

    @app.get("/")
    def home():
        return render_template("index.html")

    @app.get("/career")
    def career_page():
        return render_template("career.html")

    @app.get("/resume")
    def resume_page():
        return render_template("resume.html")

    @app.get("/dashboard")
    def dashboard_page():
        return render_template("dashboard.html")

    @app.get("/skill-proof")
    def skill_proof_page():
        return render_template("skill_proof.html")

    @app.get("/interview")
    def interview_page():
        return render_template("interview.html")

    @app.get("/api/roles")
    def role_catalog():
        from services.career_service import get_role_names

        return jsonify({"roles": get_role_names()})

    @app.post("/api/career-guide")
    def career_guide():
        payload = request.get_json(silent=True) or {}
        name = str(payload.get("name", "")).strip()
        role = str(payload.get("target_role", "")).strip()
        skills = payload.get("skills", "")
        if not name:
            return jsonify({"error": "Please enter your name."}), 400
        if not role:
            return jsonify({"error": "Please enter a target role."}), 400
        if not isinstance(skills, str) or not skills.strip():
            return jsonify({"error": "Please add at least one current skill."}), 400
        if len(name) > 80 or len(role) > 100 or len(skills) > 1200:
            return jsonify({"error": "One or more fields are too long."}), 400

        result = build_career_guide(name, role, skills)
        session["career_snapshot"] = {
            "target_role": result["target_role"],
            "skills": result["current_skills"],
            "gaps": result["missing_skills"],
        }
        return jsonify(result)

    @app.post("/api/resume-analysis")
    def resume_analysis():
        role = str(request.form.get("target_role", "")).strip()
        resume_file = request.files.get("resume")
        if not role:
            return jsonify({"error": "Please enter a target role."}), 400
        if len(role) > 100:
            return jsonify({"error": "Target role must be 100 characters or fewer."}), 400
        if not resume_file or not resume_file.filename:
            return jsonify({"error": "Please choose a resume file."}), 400
        try:
            result = analyze_resume(resume_file, role)
        except ResumeInputError as error:
            return jsonify({"error": str(error)}), 400
        except Exception:
            app.logger.exception("Resume analysis failed")
            return jsonify({"error": "We could not read this resume. Try a text-based PDF, DOCX, or TXT file."}), 422

        session["resume_snapshot"] = {
            "target_role": role,
            "score": result["compatibility_score"],
            "skills": result["resume_skills"],
            "gaps": result["missing_skills"],
        }
        return jsonify(result)

    @app.post("/api/skill-challenge")
    def skill_challenge():
        payload = request.get_json(silent=True) or {}
        skill = str(payload.get("skill", "")).strip()
        role = str(payload.get("target_role", "")).strip()
        if not skill or len(skill) > 80:
            return jsonify({"error": "Please provide a valid skill."}), 400
        return jsonify(make_skill_challenge(skill, role))

    @app.post("/api/skill-evaluation")
    def skill_evaluation():
        payload = request.get_json(silent=True) or {}
        skill = str(payload.get("skill", "")).strip()
        solution = str(payload.get("solution", "")).strip()
        challenge = str(payload.get("challenge", "")).strip()
        if not skill or not solution:
            return jsonify({"error": "Choose a skill and submit your solution."}), 400
        if len(solution) > 12000 or len(challenge) > 1500:
            return jsonify({"error": "The submission is too long. Please shorten it and try again."}), 400
        return jsonify(review_skill_solution(skill, challenge, solution))

    @app.post("/api/projects")
    def projects():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("target_role", "")).strip()
        if not role:
            return jsonify({"error": "Please provide a target role."}), 400
        return jsonify(generate_projects(role, payload.get("skills", []), payload.get("missing_skills", [])))

    @app.post("/api/interview-questions")
    def interview_questions():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("target_role", "")).strip()
        if not role:
            return jsonify({"error": "Please provide a target role."}), 400
        return jsonify(generate_interview_questions(
            role,
            payload.get("skills", []),
            payload.get("missing_skills", []),
            str(payload.get("resume_text", ""))[:3000],
        ))

    @app.post("/api/interview-feedback")
    def interview_feedback():
        payload = request.get_json(silent=True) or {}
        question = str(payload.get("question", "")).strip()
        answer = str(payload.get("answer", "")).strip()
        if not question or not answer:
            return jsonify({"error": "Add both the question and your answer."}), 400
        if len(answer) > 5000:
            return jsonify({"error": "Please keep your answer under 5,000 characters."}), 400
        return jsonify(review_answer(question, answer))

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")