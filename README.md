# AI Career Guide and Resume Analyzer

**From Resume → Skill Gap → Skill Proof → Career Ready**

A small Flask application for exploring a target role, planning a month of learning, reviewing a resume, practicing skill challenges, and preparing for interviews. HTML, CSS, vanilla JavaScript, Python, and editable JSON are used throughout.

## Run locally

1. Install Python 3.10 or newer.
2. Create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

4. Edit `.env`. Replace `your_api_key_here` with a Gemini API key, and set `FLASK_SECRET_KEY` to a long random value. The app still runs without a Gemini key; generated guidance falls back to local role data and displays a friendly notice.
5. Start Flask:

   ```powershell
   python app.py
   ```

6. Open <http://127.0.0.1:5000>.

Do not commit `.env`. The Gemini key is read only by the Python service and is never sent to browser JavaScript. The development server should not be exposed publicly.

## Project map

- `app.py` defines page routes, JSON API routes, validation, and safe error responses.
- `services/gemini_service.py` contains the single backend-only Gemini integration and handles unavailable/invalid responses.
- `services/career_service.py` compares skills with role profiles and prepares learning plans, challenges, project ideas, and interview practice.
- `services/resume_service.py` reads PDF, DOCX, or TXT files in memory, detects known role skills, and builds the estimated compatibility review.
- `data/*.json` contains role profiles, skill labels, learning links, and job portals that can be edited without changing Python code.
- `templates/` contains the shared page layout and six focused screens.
- `static/css/style.css` and `static/js/script.js` implement the responsive interface and connect forms to Flask.

## Screens and workflows

- **Career guide:** submit name, target role, and current skills to see matches, skill gaps, priority, a dependency sequence, and a 30-day plan.
- **Resume lab:** upload a text-readable PDF, DOCX, or TXT file (up to 5 MB) for skill coverage, improvement suggestions, keywords, certifications, and relevant job portals.
- **Prove your skill:** create a challenge and submit a solution for short educational AI feedback. This is not an official certification.
- **Project ideas:** generate two or three portfolio project suggestions from a role and skill gaps.
- **Dashboard:** shows the latest summary saved in this browser's local storage. Resume text itself is not stored.
- **Interview room:** generate role-specific technical, resume, project, and HR prompts; submit draft answers for feedback.

## Scoring and AI limits

Resume compatibility is a simple project-generated estimate based on matching known skill phrases to the selected role profile. It is not an official ATS score and does not predict hiring outcomes. AI outputs are suggestions, can be incomplete, and should be checked. Missing or failing Gemini configuration does not stop the Flask server; the application uses straightforward local fallbacks where possible.

Resume uploads are parsed in memory, not written to `uploads/`. The 5 MB Flask request limit is also enforced server-side. Never use Flask's development server as a production deployment.