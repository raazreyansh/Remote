from __future__ import annotations

import math
import re
from typing import Any

from sqlalchemy import select

from backend.models.db import SessionLocal
from backend.models.job import Job
from backend.services.embedding_service import get_or_create_job_embedding, get_or_create_profile_embedding

WORD_RE = re.compile(r"[a-zA-Z0-9+#.]+")
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "build",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "work",
    "worked",
    "using",
}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _expand_score(score: float, exponent: float = 0.45) -> float:
    if score <= 0:
        return 0.0
    normalized = _clamp(score) / 100
    return _clamp((normalized**exponent) * 100)


def _tokenize(text: str) -> set[str]:
    return {token.lower() for token in WORD_RE.findall(text) if token.lower() not in STOPWORDS}


def _normalize_text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_normalize_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_normalize_text(item) for item in value.values())
    if value is None:
        return ""
    return str(value)


def _combine_job_text(job: Job | dict[str, Any]) -> str:
    if isinstance(job, Job):
        return f"{job.title} {job.description} {job.location}"
    return f"{job.get('title', '')} {job.get('description', '')} {job.get('location', '')}"


def _combine_profile_text(profile: dict[str, Any]) -> str:
    parts = [
        _normalize_text(profile.get("skills", [])),
        _normalize_text(profile.get("experience", [])),
        _normalize_text(profile.get("projects", [])),
        _normalize_text(profile.get("education", [])),
        _normalize_text(profile.get("roles", [])),
    ]
    return " ".join(part for part in parts if part).strip()


def _cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(vector_a, vector_b))
    magnitude_a = math.sqrt(sum(a * a for a in vector_a))
    magnitude_b = math.sqrt(sum(b * b for b in vector_b))
    if not magnitude_a or not magnitude_b:
        return 0.0
    return numerator / (magnitude_a * magnitude_b)


def _coverage_score(reference_tokens: set[str], candidate_tokens: set[str]) -> float:
    if not reference_tokens or not candidate_tokens:
        return 0.0
    overlap = reference_tokens & candidate_tokens
    return _clamp((len(overlap) / len(reference_tokens)) * 100)


def _skills_match_score(job: Job | dict[str, Any], profile: dict[str, Any]) -> float:
    skills = [skill.strip().lower() for skill in profile.get("skills", []) if str(skill).strip()]
    if not skills:
        return 0.0

    title = job.title.lower() if isinstance(job, Job) else str(job.get("title", "")).lower()
    description = job.description.lower() if isinstance(job, Job) else str(job.get("description", "")).lower()

    weighted_matches = 0.0
    for skill in skills:
        if skill in title:
            weighted_matches += 2.0
        elif skill in description:
            weighted_matches += 1.0

    normalization_base = max(1.0, min(len(skills), 4) * 2.0)
    return _clamp((weighted_matches / normalization_base) * 100)


def _experience_relevance_score(job: Job | dict[str, Any], profile: dict[str, Any]) -> float:
    experience_text = _normalize_text(profile.get("experience", []))
    project_text = _normalize_text(profile.get("projects", []))
    profile_tokens = _tokenize(f"{experience_text} {project_text}")
    job_tokens = _tokenize(_combine_job_text(job))
    return _coverage_score(profile_tokens, job_tokens)


def _role_match_score(job: Job | dict[str, Any], profile: dict[str, Any]) -> float:
    roles = [str(role).strip().lower() for role in profile.get("roles", []) if str(role).strip()]
    if not roles:
        return 0.0

    title = job.title.lower() if isinstance(job, Job) else str(job.get("title", "")).lower()
    title_tokens = _tokenize(title)
    exact_matches = sum(1 for role in roles if role in title)
    if exact_matches:
        return _clamp((exact_matches / len(roles)) * 100)

    role_scores = []
    for role in roles:
        role_tokens = _tokenize(role)
        role_scores.append(_coverage_score(role_tokens, title_tokens))

    return max(role_scores, default=0.0)


def _location_fit_score(job: Job | dict[str, Any], profile: dict[str, Any]) -> float:
    location = job.location.lower() if isinstance(job, Job) else str(job.get("location", "")).lower()
    combined_text = _combine_job_text(job).lower()
    preferred_locations = [str(item).lower() for item in profile.get("preferred_locations", []) if str(item).strip()]

    remote_tokens = ("remote", "anywhere", "worldwide")
    if any(token in location or token in combined_text for token in remote_tokens):
        return 100.0
    if preferred_locations and any(preference in location for preference in preferred_locations):
        return 100.0
    if not location:
        return 50.0
    return 35.0


def _semantic_match_score(job: Job, profile: dict[str, Any]) -> tuple[float, str]:
    profile_text = _combine_profile_text(profile)
    job_text = _combine_job_text(job)

    profile_embedding, profile_source = get_or_create_profile_embedding(profile_text)
    job_embedding, job_source = get_or_create_job_embedding(job, job_text)

    if profile_embedding is not None and job_embedding is not None:
        similarity = _cosine_similarity(profile_embedding, job_embedding)
        semantic_score = _clamp(similarity * 100)
        source = job_source if job_source != "keyword" else profile_source
        return semantic_score, source

    return -1.0, "keyword"


def calculate_match_score(job: Job | dict[str, Any], profile: dict[str, Any]) -> dict[str, float | str]:
    skills_score = _skills_match_score(job, profile)
    experience_score = _experience_relevance_score(job, profile)
    role_score = _role_match_score(job, profile)
    location_score = _location_fit_score(job, profile)

    if isinstance(job, Job):
        semantic_score, embedding_source = _semantic_match_score(job, profile)
    else:
        semantic_score, embedding_source = -1.0, "keyword"

    semantic_component = max(semantic_score, 0.0)
    final_score = _clamp(
        (skills_score * 0.30)
        + (experience_score * 0.20)
        + (role_score * 0.20)
        + (location_score * 0.10)
        + (semantic_component * 0.20)
    )
    match_score = _clamp((skills_score * 0.5) + (semantic_component * 0.5))

    expanded_match_score = _clamp(_expand_score(match_score, exponent=0.55))
    expanded_final_score = _clamp(_expand_score(final_score))
    job_title = job.title if isinstance(job, Job) else str(job.get("title", ""))

    print(
        "Match debug | "
        f"{job_title} | "
        f"embedding_source={embedding_source} | "
        f"skills={skills_score:.2f} | "
        f"experience={experience_score:.2f} | "
        f"role={role_score:.2f} | "
        f"location={location_score:.2f} | "
        f"semantic={semantic_score:.2f} | "
        f"final=(0.30*{skills_score:.2f})+(0.20*{experience_score:.2f})+"
        f"(0.20*{role_score:.2f})+(0.10*{location_score:.2f})+"
        f"(0.20*{semantic_component:.2f})={expanded_final_score:.2f}"
    )

    return {
        "match_score": round(expanded_match_score, 2),
        "skills_match_score": round(_clamp(skills_score), 2),
        "experience_score": round(_clamp(experience_score), 2),
        "role_score": round(_clamp(role_score), 2),
        "location_score": round(_clamp(location_score), 2),
        "semantic_score": round(semantic_score, 2),
        "final_score": round(expanded_final_score, 2),
        "embedding_source": embedding_source,
        "score_explanation": (
            f"Skills {skills_score:.1f}, experience {experience_score:.1f}, role {role_score:.1f}, "
            f"location {location_score:.1f}, semantic {semantic_component:.1f}."
        ),
    }


def update_all_job_scores(profile: dict[str, Any]) -> int:
    updated_jobs = 0
    with SessionLocal() as session:
        jobs = session.execute(select(Job)).scalars().all()
        for job in jobs:
            scores = calculate_match_score(job, profile)
            job.match_score = float(scores["match_score"])
            job.skills_match_score = float(scores["skills_match_score"])
            job.semantic_score = float(scores["semantic_score"])
            job.final_score = float(scores["final_score"])
            job.embedding_source = str(scores["embedding_source"])
            updated_jobs += 1

        session.commit()

    return updated_jobs


def get_top_jobs(threshold: float = 70.0, limit: int = 10) -> list[Job]:
    with SessionLocal() as session:
        return (
            session.execute(
                select(Job)
                .where(Job.final_score >= threshold)
                .order_by(Job.final_score.desc(), Job.created_at.desc())
                .limit(limit)
            )
            .scalars()
            .all()
        )
