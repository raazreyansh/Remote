from __future__ import annotations

import argparse

from backend.models.db import create_tables
from backend.services.application_service import create_or_update_application
from backend.services.apply_service import apply_to_job
from backend.services.matching import get_top_jobs, update_all_job_scores
from backend.services.profile_service import load_profile
from backend.services.job_service import ensure_job
from backend.services.resume_generator import (
    generate_cover_letter,
    generate_resume,
    save_generated_documents,
    should_generate_documents,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Phase 5 semi-automatic apply flow.")
    parser.add_argument("--profile", default="data/profile.json", help="Path to the structured profile JSON file.")
    parser.add_argument("--threshold", type=float, default=70.0, help="Minimum final score for top-job selection.")
    parser.add_argument(
        "--ignore-rejection-filter",
        action="store_true",
        help="Allow test generation even when the strict rejection filter blocks the job.",
    )
    parser.add_argument("--job-url", default="", help="Optional direct ATS job URL to seed and test.")
    parser.add_argument("--job-title", default="Direct ATS Job", help="Title to use with --job-url.")
    parser.add_argument("--job-company", default="Unknown Company", help="Company to use with --job-url.")
    parser.add_argument(
        "--no-pause",
        action="store_true",
        help="Close the browser automatically instead of waiting for manual input.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    create_tables()
    profile = load_profile(args.profile)
    update_all_job_scores(profile)

    if args.job_url:
        selected_job = ensure_job(
            {
                "title": args.job_title,
                "company": args.job_company,
                "location": "Remote",
                "url": args.job_url,
                "description": args.job_title,
                "source": "manual_direct_test",
                "match_score": 100.0,
                "skills_match_score": 100.0,
                "semantic_score": 100.0,
                "final_score": 100.0,
            }
        )
        rejection_reason = ""
    else:
        top_jobs = get_top_jobs(threshold=args.threshold, limit=10)
        if not top_jobs:
            raise RuntimeError(f"No jobs found with final_score >= {args.threshold}")

        selected_job = None
        rejection_reason = ""
        for job in top_jobs:
            allowed, reason = should_generate_documents(job)
            if allowed:
                selected_job = job
                break
            if not rejection_reason:
                rejection_reason = reason

        if selected_job is None:
            if not args.ignore_rejection_filter:
                raise RuntimeError(f"No jobs passed the rejection filter. First reason: {rejection_reason}")
            selected_job = top_jobs[0]
            print(f"Warning: bypassing rejection filter for testing. Reason: {rejection_reason}")

    resume_text = generate_resume(selected_job, profile)
    cover_letter = generate_cover_letter(selected_job, profile)
    paths = save_generated_documents(selected_job, resume_text, cover_letter)
    application_record = create_or_update_application(selected_job.id, status="opened")

    print(f"Prepared application record #{application_record.id} for job #{selected_job.id}")
    print(f"Resume saved to {paths['resume_path']}")
    print(f"Cover letter saved to {paths['cover_path']}")

    result = apply_to_job(selected_job, paths["resume_path"], cover_letter, pause_for_review=not args.no_pause)
    create_or_update_application(
        selected_job.id,
        status=result["status"],
        applied=result["status"] == "ready_for_submit",
    )
    print(result)


if __name__ == "__main__":
    main()
