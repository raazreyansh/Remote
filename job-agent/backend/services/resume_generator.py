from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Any

from backend.models.db import PROJECT_ROOT
from backend.models.job import Job

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9+#./-]{1,}")
NUMBER_RE = re.compile(r"\d+(?:\+|%|x)?")
STOPWORDS = {
    "about",
    "across",
    "and",
    "applying",
    "build",
    "candidate",
    "company",
    "contract",
    "engineer",
    "for",
    "from",
    "full",
    "full-time",
    "have",
    "help",
    "into",
    "job",
    "more",
    "our",
    "profile",
    "remote",
    "role",
    "team",
    "that",
    "the",
    "their",
    "this",
    "through",
    "time",
    "using",
    "view",
    "with",
    "world",
    "you",
    "your",
}
ACTION_VERBS = ["Built", "Delivered", "Improved", "Led", "Automated", "Optimized", "Developed", "Implemented"]
TECH_KEYWORDS = {
    "python",
    "fastapi",
    "sqlalchemy",
    "openai",
    "api",
    "apis",
    "backend",
    "docker",
    "postgresql",
    "mysql",
    "sqlite",
    "redis",
    "aws",
    "gcp",
    "azure",
    "kubernetes",
    "terraform",
    "javascript",
    "typescript",
    "react",
    "node",
    "playwright",
    "llm",
    "ai",
    "ml",
}
PRIORITY_LABELS = {1: "required", 2: "technology", 3: "responsibility"}
ML_DOMAIN_HINTS = {
    "voice": "voice systems",
    "speech": "voice systems",
    "nlp": "language models",
    "language": "language models",
    "recommendation": "recommendation systems",
    "ranking": "ranking systems",
    "vision": "computer vision",
    "image": "computer vision",
    "fraud": "trust and safety systems",
    "integrity": "trust and safety systems",
}


def _normalize_text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_normalize_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_normalize_text(item) for item in value.values())
    if value is None:
        return ""
    return str(value)


def _job_value(job: Job | dict[str, Any], field: str) -> str:
    if isinstance(job, Job):
        return str(getattr(job, field, ""))
    return str(job.get(field, ""))


def _clean_tokens(text: str) -> list[str]:
    return [token.lower() for token in WORD_RE.findall(text) if token.lower() not in STOPWORDS]


def _sentence_chunks(text: str) -> list[str]:
    return [chunk.strip() for chunk in re.split(r"[\n\r.;:]+", text) if chunk.strip()]


def extract_keywords(job_description: str, limit: int = 15, title: str = "") -> list[dict[str, Any]]:
    ranked_keywords: list[dict[str, Any]] = []
    seen: set[str] = set()
    chunks = _sentence_chunks(f"{title}. {job_description}")

    def add_keyword(keyword: str, priority: int, context: str) -> None:
        normalized = keyword.lower().strip()
        if not normalized or normalized in STOPWORDS or normalized in seen or len(normalized) < 2:
            return
        seen.add(normalized)
        ranked_keywords.append(
            {
                "keyword": keyword,
                "priority": priority,
                "category": PRIORITY_LABELS[priority],
                "context": context,
            }
        )

    for chunk in chunks:
        lowered = chunk.lower()
        tokens = _clean_tokens(chunk)
        is_required = any(marker in lowered for marker in ("must", "required", "need", "requirements", "qualification"))
        is_responsibility = any(
            marker in lowered for marker in ("responsible", "you will", "own", "deliver", "lead", "build")
        )

        for token in tokens:
            if token in TECH_KEYWORDS:
                add_keyword(token.title() if token != "ai" else "AI", 2, chunk)
            elif is_required:
                add_keyword(token.title(), 1, chunk)
            elif is_responsibility:
                add_keyword(token.title(), 3, chunk)

            if len(ranked_keywords) >= limit:
                return ranked_keywords

    token_counts = Counter(_clean_tokens(f"{title} {job_description}"))
    for token, _ in sorted(token_counts.items(), key=lambda item: (-item[1], item[0])):
        priority = 2 if token in TECH_KEYWORDS else 3
        add_keyword(token.title() if token != "ai" else "AI", priority, "frequency fallback")
        if len(ranked_keywords) >= limit:
            break

    return ranked_keywords


def _relevant_skills(job: Job | dict[str, Any], profile: dict[str, Any], limit: int = 10) -> list[str]:
    skills = [str(skill).strip() for skill in profile.get("skills", []) if str(skill).strip()]
    job_text = f"{_job_value(job, 'title')} {_job_value(job, 'description')}".lower()
    ranked: list[str] = []

    for skill in skills:
        if skill.lower() in job_text and skill not in ranked:
            ranked.append(skill)
    if len(ranked) < limit:
        for item in extract_keywords(_job_value(job, "description"), title=_job_value(job, "title"), limit=limit * 2):
            for skill in skills:
                if skill in ranked:
                    continue
                if item["keyword"].lower() in skill.lower() or skill.lower() in item["keyword"].lower():
                    ranked.append(skill)
                if len(ranked) >= limit:
                    return ranked[:limit]

    if len(ranked) < limit:
        for skill in skills:
            if skill not in ranked:
                ranked.append(skill)
            if len(ranked) >= limit:
                break

    return ranked[:limit]


def _quantify_bullet(text: str) -> str:
    if NUMBER_RE.search(text):
        return text
    return f"{text} with measurable impact on delivery speed and system reliability"


def _rewrite_experience_bullet(base_text: str, keywords: list[dict[str, Any]], action_index: int) -> str:
    action = ACTION_VERBS[action_index % len(ACTION_VERBS)]
    keyword_terms = [item["keyword"] for item in keywords[:3]]
    cleaned = base_text.rstrip(".")
    if not cleaned:
        cleaned = "Delivered backend work aligned with the role"
    if cleaned.split()[0] not in ACTION_VERBS:
        cleaned = f"{action} {cleaned[0].lower() + cleaned[1:] if cleaned else ''}"

    if keyword_terms and not any(term.lower() in cleaned.lower() for term in keyword_terms):
        cleaned += f" using {', '.join(keyword_terms)}"

    return _quantify_bullet(cleaned)


def _experience_section(profile: dict[str, Any], keywords: list[dict[str, Any]], limit: int = 4) -> list[str]:
    entries = profile.get("experience", [])
    bullets: list[str] = []

    for entry in entries:
        if isinstance(entry, dict):
            title = str(entry.get("title", "")).strip()
            company = str(entry.get("company", "")).strip()
            duration = str(entry.get("duration", "")).strip()
            prefix = " - ".join(part for part in [title, company, duration] if part)
            highlights = [str(item).strip() for item in entry.get("highlights", []) if str(item).strip()]
            if prefix:
                bullets.append(prefix)
            for index, highlight in enumerate(highlights[:2]):
                bullets.append(_rewrite_experience_bullet(highlight, keywords, index))
        else:
            bullets.append(_rewrite_experience_bullet(str(entry).strip(), keywords, len(bullets)))

        if len(bullets) >= limit:
            break

    return bullets[:limit] or ["Delivered backend and AI-focused work relevant to the target role."]


def _project_section(profile: dict[str, Any], keywords: list[dict[str, Any]], limit: int = 2) -> list[str]:
    projects = profile.get("projects", [])
    bullets: list[str] = []

    for index, project in enumerate(projects):
        if isinstance(project, dict):
            name = str(project.get("name", "")).strip()
            description = str(project.get("description", "")).strip()
            technologies = ", ".join(str(item).strip() for item in project.get("technologies", []) if str(item).strip())
            base = " - ".join(part for part in [name, description] if part)
            if technologies:
                base += f" using {technologies}"
            bullets.append(_rewrite_experience_bullet(base, keywords, index))
        else:
            bullets.append(_rewrite_experience_bullet(str(project).strip(), keywords, index))

        if len(bullets) >= limit:
            break

    return bullets[:limit] or ["Built projects that combine backend systems, ranking logic, and AI-assisted workflows."]


def _infer_ml_domain(job: Job | dict[str, Any], keywords: list[dict[str, Any]]) -> str:
    combined_text = f"{_job_value(job, 'title')} {_job_value(job, 'description')}".lower()
    for token, label in ML_DOMAIN_HINTS.items():
        if token in combined_text:
            return label
    for item in keywords:
        lowered = item["keyword"].lower()
        for token, label in ML_DOMAIN_HINTS.items():
            if token in lowered:
                return label
    return "production ML systems"


def _company_insight(job: Job | dict[str, Any], keywords: list[dict[str, Any]]) -> str:
    company = _job_value(job, "company")
    title = _job_value(job, "title")
    top_terms = ", ".join(item["keyword"] for item in keywords[:3]) or "reliable ML delivery"
    return f"I noticed {company} is hiring for {title} with emphasis on {top_terms}."


def _problem_statement(job: Job | dict[str, Any], keywords: list[dict[str, Any]]) -> str:
    domain = _infer_ml_domain(job, keywords)
    tech_focus = ", ".join(item["keyword"] for item in keywords[:2]) or "model evaluation"
    return f"That usually means building {domain} that depend on strong {tech_focus} under real production constraints."


def should_generate_documents(job: Job | dict[str, Any]) -> tuple[bool, str]:
    semantic_score = job.semantic_score if isinstance(job, Job) else float(job.get("semantic_score", 0.0))
    skills_score = job.skills_match_score if isinstance(job, Job) else float(job.get("skills_match_score", 0.0))

    if semantic_score < 20:
        return False, f"semantic_score too low: {semantic_score}"
    if skills_score < 30:
        return False, f"skills_match_score too low: {skills_score}"
    return True, "eligible"


def generate_resume(job: Job | dict[str, Any], profile: dict[str, Any]) -> str:
    title = _job_value(job, "title")
    company = _job_value(job, "company")
    location = _job_value(job, "location")
    keywords = extract_keywords(_job_value(job, "description"), limit=15, title=title)
    relevant_skills = _relevant_skills(job, profile, limit=10)
    experiences = _experience_section(profile, keywords)
    projects = _project_section(profile, keywords)
    roles = ", ".join(str(role).strip() for role in profile.get("roles", []) if str(role).strip())
    education = _normalize_text(profile.get("education", []))
    top_keywords = ", ".join(item["keyword"] for item in keywords[:6])

    sections = [
        "TARGET ROLE",
        f"{title} at {company}",
        "",
        "SUMMARY",
        (
            f"Backend-focused candidate targeting {title} opportunities with experience across {roles}. "
            f"Brings direct alignment with {top_keywords} and a track record of shipping reliable systems in remote environments."
        ),
        "",
        "SKILLS",
        ", ".join(relevant_skills),
        "",
        "EXPERIENCE",
    ]

    sections.extend(f"- {item}" for item in experiences)
    sections.extend(["", "PROJECTS"])
    sections.extend(f"- {item}" for item in projects)
    sections.extend(
        [
            "",
            "EDUCATION",
            education or "Education available in structured profile.",
            "",
            "JOB FIT",
            f"Location: {location}",
            "Priority keywords: "
            + ", ".join(f"{item['keyword']} (P{item['priority']})" for item in keywords[:10]),
        ]
    )

    return "\n".join(sections).strip()


def generate_cover_letter(job: Job | dict[str, Any], profile: dict[str, Any]) -> str:
    title = _job_value(job, "title")
    company = _job_value(job, "company")
    keywords = extract_keywords(_job_value(job, "description"), limit=12, title=title)
    relevant_skills = _relevant_skills(job, profile, limit=6)
    experience_points = [item for item in _experience_section(profile, keywords, limit=3) if " - " not in item][:2]
    domain = _infer_ml_domain(job, keywords)
    insight = _company_insight(job, keywords)
    problem_statement = _problem_statement(job, keywords)
    technical_capability = ", ".join(relevant_skills[:3]) or "Python, ML pipelines, and API integration"

    opening = (
        f"The {title} role at {company} aligns with the work I have been doing across {technical_capability}."
    )
    body = (
        f"{insight} {problem_statement} "
        f"{experience_points[0] if experience_points else 'Built backend systems that support production delivery'}. "
        f"{experience_points[1] if len(experience_points) > 1 else 'Improved execution quality by shipping maintainable services with clear ownership'}. "
        f"I have worked on model evaluation, data preprocessing, and API-connected ML workflows, and I am especially interested in applying that experience to {domain}."
    )
    closing = (
        f"I can add value quickly at {company} by owning implementation, communicating clearly, and helping the team ship high-quality results as a {title}."
    )

    letter = " ".join([opening, body, closing]).strip()
    words = letter.split()
    if len(words) > 200:
        letter = " ".join(words[:200])
    return letter


def save_generated_documents(job: Job | dict[str, Any], resume_text: str, cover_letter: str) -> dict[str, Path]:
    job_id = job.id if isinstance(job, Job) else int(job["id"])
    output_dir = PROJECT_ROOT / "generated"
    output_dir.mkdir(parents=True, exist_ok=True)

    resume_path = output_dir / f"resume_{job_id}.txt"
    cover_path = output_dir / f"cover_{job_id}.txt"
    resume_path.write_text(resume_text, encoding="utf-8")
    cover_path.write_text(cover_letter, encoding="utf-8")

    return {"resume_path": resume_path, "cover_path": cover_path}
