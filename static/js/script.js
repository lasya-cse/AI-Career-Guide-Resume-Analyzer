const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const safeHref = (value) => {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#";
  } catch (_error) { return "#"; }
};
const list = (values, empty = "Nothing to show yet.") => Array.isArray(values) && values.length
  ? `<ul class="clean-list">${values.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.skill || item.title || item.question || "")}</li>`).join("")}</ul>`
  : `<p class="muted-copy">${escapeHtml(empty)}</p>`;

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function setMessage(form, message = "", error = false) {
  const target = form.querySelector(".form-message");
  if (target) {
    target.textContent = message;
    target.classList.toggle("is-error", error);
  }
}

function setBusy(form, busy, label) {
  const button = form.querySelector("button[type=submit]");
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = label || "Working...";
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalLabel || "Submit";
  }
}

function saveDashboard(key, value) {
  try {
    const current = JSON.parse(localStorage.getItem("careerCompass") || "{}");
    current[key] = value;
    localStorage.setItem("careerCompass", JSON.stringify(current));
  } catch (_error) { /* Storage may be disabled; current page remains usable. */ }
}

function showNotice(notice) {
  return notice ? `<p class="ai-notice">${escapeHtml(notice)}</p>` : "";
}

function renderCareer(data) {
  const plan = Array.isArray(data.plan) ? data.plan : [];
  const priorities = (data.priorities || []).map((item) => `<li><span>${escapeHtml(item.skill)}</span><b class="priority-${escapeHtml((item.priority || "medium").toLowerCase())}">${escapeHtml(item.priority)}</b></li>`).join("");
  const planCards = plan.map((item) => `<article class="day-card"><span class="day-tag">DAY ${escapeHtml(item.day)}</span><h4>${escapeHtml(item.topic)}</h4><p>${escapeHtml(item.task)}</p><a href="${safeHref(item.resource_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.resource_title)} ↗</a></article>`).join("");
  return `<div class="result-heading"><div><p class="eyebrow">YOUR PERSONAL ROADMAP</p><h2>${escapeHtml(data.target_role)}</h2><p class="muted-copy">A practical starting point for ${escapeHtml(data.name)}.</p></div><div class="score-ring" style="--score:${Number(data.skill_coverage) || 0}%"><strong>${Number(data.skill_coverage) || 0}%</strong><small>coverage</small></div></div>
    ${showNotice(data.ai_notice)}
    <div class="result-columns"><section><h3>Skills already aligned</h3>${list(data.matching_skills, "Your current skills are still useful. Keep building them.")}</section><section><h3>Skills to strengthen</h3>${list(data.missing_skills)}</section></div>
    <section class="result-section"><h3>Suggested priorities</h3><ul class="priority-list">${priorities || "<li>Keep practicing your role fundamentals.</li>"}</ul></section>
    <section class="result-section"><h3>Learning sequence</h3><div class="dependency-map">${(data.dependency_sequence || []).map((skill, index) => `<span class="dependency-node">${escapeHtml(skill)}</span>${index < data.dependency_sequence.length - 1 ? '<span class="dependency-arrow">↓</span>' : ""}`).join("")}</div></section>
    <section class="result-section"><div class="section-title-row"><div><p class="eyebrow">ONE DAY AT A TIME</p><h3>Your 30-day plan</h3></div><span class="small-mono">30 MIN / DAY</span></div><div class="timeline-grid">${planCards}</div></section>
    <section class="result-section"><div class="section-title-row"><div><p class="eyebrow">PUT LEARNING INTO PRACTICE</p><h3>Try a skill challenge</h3></div><a class="text-link" href="/skill-proof">Open skill proof →</a></div><div class="chip-row">${(data.missing_skills || []).slice(0, 4).map((skill) => `<button class="skill-challenge-button" data-skill="${escapeHtml(skill)}">Prove ${escapeHtml(skill)} ↗</button>`).join("") || '<a class="text-link" href="/skill-proof">Choose a skill →</a>'}</div></section>
    <section class="result-section"><div class="section-title-row"><h3>Project ideas</h3><button class="button button-outline project-generate" type="button">Generate projects ↗</button></div><div class="project-results"></div></section>`;
}

function renderProjects(data) {
  const projects = data.projects || [];
  return `${showNotice(data.ai_notice)}<div class="project-grid">${projects.map((project) => `<article class="project-card"><p class="eyebrow">BUILD / PORTFOLIO</p><h4>${escapeHtml(project.title)}</h4><p>${escapeHtml(project.problem)}</p><div class="tag-row">${(project.technologies || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div><p><strong>Why it helps:</strong> ${escapeHtml(project.role_value)}</p><p><strong>Skills:</strong> ${escapeHtml((project.skills || []).join(", "))}</p><ol>${(project.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></article>`).join("")}</div>`;
}

function renderResume(data) {
  return `<div class="result-heading"><div><p class="eyebrow">${escapeHtml(data.score_label)}</p><h2>${escapeHtml(data.target_role)}</h2><p class="muted-copy">Estimated project-generated compatibility, not an official ATS score.</p></div><div class="score-ring" style="--score:${Number(data.compatibility_score) || 0}%"><strong>${Number(data.compatibility_score) || 0}</strong><small>estimate</small></div></div>
    ${showNotice(data.ai_notice)}
    <section class="result-section"><h3>Skills found in your resume</h3>${list(data.resume_skills)}</section><div class="result-columns"><section><h3>Matching skills</h3>${list(data.matching_skills)}</section><section><h3>Missing skills</h3>${list(data.missing_skills)}</section></div><section class="result-section"><h3>Skills with limited resume evidence</h3>${list(data.weak_skills, "No matched skills appeared only once in the resume text.")}</section>
    <div class="result-columns"><section><h3>Improvement areas</h3>${list(data.improvement_areas)}</section><section><h3>Certifications to consider</h3>${list(data.certifications)}</section></div>
    <section class="result-section"><h3>Useful keywords</h3><div class="tag-row">${(data.keywords || []).map((term) => `<span>${escapeHtml(term)}</span>`).join("")}</div></section>
    <section class="result-section"><h3>What shapes this estimate</h3>${list(data.score_factors)}</section>
    <section class="result-section"><h3>Job portals for this role</h3><div class="portal-row">${(data.job_portals || []).map((portal) => `<a href="${safeHref(portal.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(portal.name)} ↗</a>`).join("")}</div></section>
    <section class="result-section"><div class="section-title-row"><h3>Turn a gap into skill proof</h3><a class="text-link" href="/skill-proof">Prove a skill →</a></div><div class="chip-row">${(data.missing_skills || []).slice(0, 5).map((skill) => `<button class="skill-challenge-button" data-skill="${escapeHtml(skill)}">Prove ${escapeHtml(skill)} ↗</button>`).join("")}</div></section>
    <section class="result-section"><div class="section-title-row"><h3>Project ideas</h3><button class="button button-outline project-generate" type="button">Generate projects ↗</button></div><div class="project-results"></div></section>`;
}

function attachResultActions(container, snapshot) {
  container.querySelectorAll(".skill-challenge-button").forEach((button) => button.addEventListener("click", () => {
    const state = { ...snapshot, skill: button.dataset.skill };
    saveDashboard("proof", state);
    window.location.href = `/skill-proof?skill=${encodeURIComponent(button.dataset.skill)}&role=${encodeURIComponent(snapshot.target_role || "")}`;
  }));
  container.querySelectorAll(".project-generate").forEach((button) => button.addEventListener("click", async () => {
    const output = container.querySelector(".project-results");
    button.disabled = true;
    button.textContent = "Creating ideas...";
    try {
      const projects = await requestJson("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
      output.innerHTML = renderProjects(projects);
      saveDashboard("projects", projects.projects || []);
    } catch (error) { output.innerHTML = `<p class="form-message is-error">${escapeHtml(error.message)}</p>`; }
    button.disabled = false;
    button.textContent = "Generate projects ↗";
  }));
}

async function loadRoles() {
  const inputs = document.querySelectorAll("#role-options");
  if (!inputs.length) return;
  try {
    const data = await requestJson("/api/roles");
    const options = data.roles.map((role) => `<option value="${escapeHtml(role)}"></option>`).join("");
    inputs.forEach((element) => { element.innerHTML = options; });
  } catch (_error) { /* Free text remains available. */ }
}

const careerForm = document.querySelector("#career-form");
if (careerForm) careerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(careerForm);
  setBusy(careerForm, true, "Mapping your next steps...");
  try {
    const formData = new FormData(careerForm);
    const result = await requestJson("/api/career-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
    saveDashboard("career", result);
    saveDashboard("completedDays", []);
    const output = document.querySelector("#career-results");
    output.innerHTML = renderCareer(result);
    attachResultActions(output, { target_role: result.target_role, skills: result.current_skills, missing_skills: result.missing_skills });
  } catch (error) { setMessage(careerForm, error.message, true); }
  finally { setBusy(careerForm, false); }
});

const resumeForm = document.querySelector("#resume-form");
if (resumeForm) resumeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(resumeForm);
  const file = resumeForm.querySelector("input[type=file]").files[0];
  if (!file) { setMessage(resumeForm, "Please choose your resume file.", true); return; }
  if (file.size > 5 * 1024 * 1024) { setMessage(resumeForm, "Please upload a file smaller than 5 MB.", true); return; }
  setBusy(resumeForm, true, "Reading your resume...");
  try {
    const result = await requestJson("/api/resume-analysis", { method: "POST", body: new FormData(resumeForm) });
    saveDashboard("resume", result);
    const output = document.querySelector("#resume-results");
    output.innerHTML = renderResume(result);
    attachResultActions(output, { target_role: result.target_role, skills: result.resume_skills, missing_skills: result.missing_skills });
  } catch (error) { setMessage(resumeForm, error.message, true); }
  finally { setBusy(resumeForm, false); }
});

const proofForm = document.querySelector("#proof-form");
const params = new URLSearchParams(window.location.search);
if (proofForm) {
  if (params.has("skill")) document.querySelector("#proof-skill").value = params.get("skill");
  if (params.has("role")) document.querySelector("#proof-role").value = params.get("role");
  proofForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(proofForm);
    setBusy(proofForm, true, "Creating your challenge...");
    try {
      const data = await requestJson("/api/skill-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skill: document.querySelector("#proof-skill").value, target_role: document.querySelector("#proof-role").value }) });
      const output = document.querySelector("#proof-results");
      output.innerHTML = `<div class="challenge-card"><p class="eyebrow">YOUR CHALLENGE / ${escapeHtml(data.skill)}</p><h2>${escapeHtml(data.challenge)}</h2><h3>What to demonstrate</h3>${list(data.success_criteria)}${showNotice(data.ai_notice)}<form id="solution-form" class="solution-form"><label for="solution-text">Your solution or explanation</label><textarea id="solution-text" rows="9" maxlength="12000" placeholder="Write code or explain your practical solution..." required></textarea><button class="button button-dark" type="submit">Get educational feedback ↗</button><p class="form-message" aria-live="polite"></p></form></div>`;
      document.querySelector("#solution-form").addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        const solutionForm = submitEvent.currentTarget;
        setMessage(solutionForm);
        setBusy(solutionForm, true, "Reviewing your submission...");
        try {
          const review = await requestJson("/api/skill-evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skill: data.skill, challenge: data.challenge, solution: document.querySelector("#solution-text").value }) });
          const feedback = document.createElement("section");
          feedback.className = `evaluation-result ${review.demonstrated ? "is-demonstrated" : "is-improvement"}`;
          feedback.innerHTML = `<p class="eyebrow">EDUCATIONAL AI EVALUATION</p><h3>${escapeHtml(review.label)}</h3><p>${escapeHtml(review.feedback)}</p><div class="result-columns"><div><strong>Correctness</strong><p>${escapeHtml(review.correctness)}</p></div><div><strong>Concept understanding</strong><p>${escapeHtml(review.concept_understanding)}</p></div><div><strong>Code quality</strong><p>${escapeHtml(review.code_quality)}</p></div></div>${list(review.missing_requirements, "No specific requirement gaps were returned.")}${list(review.improvement_suggestions)}<p class="field-hint">${escapeHtml(review.disclaimer)}</p>${showNotice(review.ai_notice)}`;
          solutionForm.after(feedback);
          saveDashboard("demonstrated", [...new Set([...(JSON.parse(localStorage.getItem("careerCompass") || "{}").demonstrated || []), ...(review.demonstrated ? [data.skill] : [])])]);
        } catch (error) { setMessage(solutionForm, error.message, true); }
        finally { setBusy(solutionForm, false); }
      });
    } catch (error) { setMessage(proofForm, error.message, true); }
    finally { setBusy(proofForm, false); }
  });
}

const interviewForm = document.querySelector("#interview-form");
if (interviewForm) interviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(interviewForm);
  setBusy(interviewForm, true, "Preparing questions...");
  try {
    const fields = interviewForm.querySelectorAll("input");
    const result = await requestJson("/api/interview-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_role: fields[0].value, skills: fields[1].value.split(",").map((item) => item.trim()).filter(Boolean), missing_skills: fields[2].value.split(",").map((item) => item.trim()).filter(Boolean), resume_text: fields[3].value }) });
    const output = document.querySelector("#interview-results");
    output.innerHTML = `${showNotice(result.ai_notice)}<div class="question-grid">${result.questions.map((item, index) => `<article class="question-card"><div class="question-meta"><span>${escapeHtml(item.category)}</span><span>Q${String(index + 1).padStart(2, "0")}</span></div><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.focus || "")}</p><form class="answer-form" data-question="${escapeHtml(item.question)}"><label for="answer-${index}">Try your answer</label><textarea id="answer-${index}" rows="3" maxlength="5000" placeholder="A few focused sentences..." required></textarea><button class="text-button" type="submit">Get feedback ↗</button><div class="answer-feedback" aria-live="polite"></div></form></article>`).join("")}</div>`;
    output.querySelectorAll(".answer-form").forEach((form) => form.addEventListener("submit", async (answerEvent) => {
      answerEvent.preventDefault();
      const button = form.querySelector("button");
      const feedback = form.querySelector(".answer-feedback");
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Reviewing...";
      try {
        const review = await requestJson("/api/interview-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: form.dataset.question, answer: form.querySelector("textarea").value }) });
        feedback.innerHTML = `${showNotice(review.ai_notice)}<p><strong>Strengths</strong></p>${list(review.strengths)}<p><strong>Try next</strong></p>${list(review.improvements)}<p>${escapeHtml(review.sample_tip)}</p>`;
      } catch (error) { feedback.textContent = error.message; }
      finally { button.disabled = false; button.textContent = original; }
    }));
  } catch (error) { setMessage(interviewForm, error.message, true); }
  finally { setBusy(interviewForm, false); }
});

function renderDashboard() {
  const container = document.querySelector("#dashboard-content");
  if (!container) return;
  let data = {};
  try { data = JSON.parse(localStorage.getItem("careerCompass") || "{}"); } catch (_error) { data = {}; }
  const career = data.career;
  const resume = data.resume;
  if (!career && !resume) return;
  const role = career?.target_role || resume?.target_role || "Your target role";
  const coverage = career?.skill_coverage;
  const score = resume?.compatibility_score;
  const gaps = [...new Set([...(career?.missing_skills || []), ...(resume?.missing_skills || [])])];
  const projects = data.projects || [];
  const demonstrated = data.demonstrated || [];
  const plan = career?.plan || [];
  const completedDays = new Set(data.completedDays || []);
  container.innerHTML = `<div class="dashboard-top"><div><p class="eyebrow">READINESS SNAPSHOT</p><h2>${escapeHtml(role)}</h2><p class="muted-copy">Based on your latest saved guide and resume review.</p></div><a class="text-link" href="/career">Update roadmap →</a></div>
    <div class="metric-grid"><article class="metric-card"><span>RESUME COMPATIBILITY</span><strong>${score === undefined ? "—" : `${Number(score)}%`}</strong><p>Estimated project score, not an official ATS result.</p></article><article class="metric-card"><span>SKILL COVERAGE</span><strong>${coverage === undefined ? "—" : `${Number(coverage)}%`}</strong><div class="progress-track"><span style="width:${Math.max(0, Math.min(Number(coverage) || 0, 100))}%"></span></div></article><article class="metric-card"><span>SKILLS DEMONSTRATED</span><strong>${demonstrated.length}</strong><p>${escapeHtml(demonstrated.join(", ") || "No completed skill reviews yet.")}</p></article><article class="metric-card"><span>SKILL GAPS</span><strong>${gaps.length}</strong><p>${escapeHtml(gaps.slice(0, 3).join(", ") || "Keep exploring role skills.")}</p></article></div>
    <section class="dashboard-section roadmap-progress"><div class="section-title-row"><div><p class="eyebrow">ROADMAP PROGRESS</p><h3>Your 30-day plan</h3></div><strong class="roadmap-count" id="roadmap-count">${completedDays.size} / ${plan.length || 30} days</strong></div><div class="progress-track"><span id="roadmap-progress-bar" style="width:${plan.length ? Math.round(completedDays.size / plan.length * 100) : 0}%"></span></div>${plan.length ? `<details class="roadmap-details"><summary>Open day-by-day checklist</summary><div class="roadmap-checklist">${plan.map((day) => `<label><input class="roadmap-day-toggle" type="checkbox" value="${Number(day.day)}" ${completedDays.has(Number(day.day)) ? "checked" : ""}><span><b>Day ${Number(day.day)}:</b> ${escapeHtml(day.topic)}</span></label>`).join("")}</div></details>` : '<p class="muted-copy">Build a roadmap to add day-by-day progress here.</p>'}</section>
    <div class="dashboard-columns"><section class="dashboard-section"><div class="section-title-row"><div><p class="eyebrow">NEXT TO BUILD</p><h3>Recommended projects</h3></div><button class="button button-outline" id="dashboard-projects">Refresh ideas ↗</button></div><div id="dashboard-project-results">${projects.length ? renderProjects({ projects }) : '<p class="muted-copy">Build a roadmap to generate project ideas matched to your skill gaps.</p>'}</div></section><section class="dashboard-section"><p class="eyebrow">GET READY TO TALK</p><h3>Interview preparation</h3><p>Practice role-specific questions and shape concise stories around your projects, strengths, and learning.</p><a class="text-link" href="/interview">Open interview room →</a><div class="readiness-note"><span>YOUR PROGRESS</span><strong>${career ? `${plan.length} days planned` : "Roadmap not started"}</strong><a href="/career">View learning plan ↗</a></div></section></div>`;
  container.querySelectorAll(".roadmap-day-toggle").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const checkedDays = [...container.querySelectorAll(".roadmap-day-toggle:checked")].map((item) => Number(item.value));
    saveDashboard("completedDays", checkedDays);
    const percentage = plan.length ? Math.round(checkedDays.length / plan.length * 100) : 0;
    container.querySelector("#roadmap-count").textContent = `${checkedDays.length} / ${plan.length || 30} days`;
    container.querySelector("#roadmap-progress-bar").style.width = `${percentage}%`;
  }));
  const button = document.querySelector("#dashboard-projects");
  if (button) button.addEventListener("click", async () => {
    button.disabled = true;
    const source = career || resume;
    try {
      const result = await requestJson("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_role: role, skills: source.current_skills || source.skills || source.resume_skills || [], missing_skills: gaps }) });
      saveDashboard("projects", result.projects);
      document.querySelector("#dashboard-project-results").innerHTML = renderProjects(result);
    } catch (error) { document.querySelector("#dashboard-project-results").innerHTML = `<p class="form-message is-error">${escapeHtml(error.message)}</p>`; }
    finally { button.disabled = false; }
  });
}

const menuToggle = document.querySelector(".menu-toggle");
if (menuToggle) menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  document.querySelector(".main-nav").classList.toggle("is-open", !open);
});

loadRoles();
renderDashboard();