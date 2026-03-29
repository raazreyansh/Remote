from __future__ import annotations

import argparse

from backend.models.db import create_tables
from backend.services.matching import get_top_jobs, update_all_job_scores
from backend.services.profile_service import load_profile


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Phase 3 matching pipeline.")
    parser.add_argument(
        "--profile",
        default="data/profile.json",
        help="Path to the structured profile JSON file.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=70.0,
        help="Minimum final score for top jobs.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of ranked jobs to print.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    create_tables()
    profile = load_profile(args.profile)
    updated_jobs = update_all_job_scores(profile)
    top_jobs = get_top_jobs(threshold=args.threshold, limit=args.limit)

    print(f"Updated scores for {updated_jobs} jobs")
    if not top_jobs:
        print(f"No jobs found with final_score >= {args.threshold}")
        return

    print("Top jobs:")
    for job in top_jobs:
        print(
            f"{job.title} - {job.final_score:.2f} "
            f"(skills={job.skills_match_score:.2f}, semantic={job.semantic_score:.2f})"
        )


if __name__ == "__main__":
    main()
