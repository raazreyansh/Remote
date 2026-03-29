from __future__ import annotations

import argparse

from backend.models.db import create_tables
from backend.services.matching import get_top_jobs, update_all_job_scores
from backend.services.profile_service import load_profile
from backend.services.resume_generator import generate_cover_letter, generate_resume


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Phase 4 content generation pipeline.")
    parser.add_argument(
        "--profile",
        default="data/profile.json",
        help="Path to the structured profile JSON file.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=70.0,
        help="Minimum final score for the selected top job.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    create_tables()
    profile = load_profile(args.profile)
    update_all_job_scores(profile)
    top_jobs = get_top_jobs(threshold=args.threshold, limit=1)
    if not top_jobs:
        raise RuntimeError(f"No jobs found with final_score >= {args.threshold}")

    job = top_jobs[0]
    tailored_resume = generate_resume(job, profile)
    cover_letter = generate_cover_letter(job, profile)

    print(f"Selected job: {job.title} at {job.company} ({job.final_score:.2f})")
    print("\nTAILORED RESUME\n")
    print(tailored_resume)
    print("\nCOVER LETTER\n")
    print(cover_letter)


if __name__ == "__main__":
    main()
