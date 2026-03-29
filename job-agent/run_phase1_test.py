from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv

from backend.services.resume_parser import extract_text_from_pdf, parse_resume_with_ai


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Phase 1 resume parsing pipeline.")
    parser.add_argument(
        "--resume",
        default="data/resume.pdf",
        help="Path to the resume PDF relative to the project root or as an absolute path.",
    )
    parser.add_argument(
        "--output",
        default="data/profile.json",
        help="Path to write the structured JSON profile.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    project_root = Path(__file__).resolve().parent
    load_dotenv(project_root / ".env")

    resume_path = Path(args.resume)
    if not resume_path.is_absolute():
        resume_path = project_root / resume_path

    if not resume_path.exists():
        raise FileNotFoundError(
            f"Missing resume file at {resume_path}. Add your resume and rerun."
        )

    resume_text = extract_text_from_pdf(resume_path)
    structured_profile = parse_resume_with_ai(resume_text)
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = project_root / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(structured_profile, indent=2), encoding="utf-8")
    print(json.dumps(structured_profile, indent=2))
    print(f"\nSaved structured profile to {output_path}")


if __name__ == "__main__":
    main()
