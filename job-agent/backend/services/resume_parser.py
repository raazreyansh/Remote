from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import fitz
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

load_dotenv()


class ResumeProfile(BaseModel):
    skills: list[str] = Field(default_factory=list)
    experience: list[dict[str, Any] | str] = Field(default_factory=list)
    projects: list[dict[str, Any] | str] = Field(default_factory=list)
    education: list[dict[str, Any] | str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)


def extract_text_from_pdf(file_path: str | Path) -> str:
    pdf_path = Path(file_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Resume PDF not found: {pdf_path}")

    with fitz.open(pdf_path) as document:
        text = "".join(page.get_text() for page in document)

    cleaned_text = text.strip()
    if not cleaned_text:
        raise ValueError(f"No extractable text found in PDF: {pdf_path}")

    return cleaned_text


def _build_prompt(text: str) -> str:
    return f"""
Extract structured data from this resume.

Return valid JSON with exactly this shape:
{{
  "skills": ["string"],
  "experience": [{{"company": "string", "title": "string", "duration": "string", "highlights": ["string"]}}],
  "projects": [{{"name": "string", "description": "string", "technologies": ["string"]}}],
  "education": [{{"institution": "string", "degree": "string", "year": "string"}}],
  "roles": ["string"]
}}

Rules:
- Return JSON only. No markdown fences.
- Use empty arrays when data is missing.
- Keep extracted text faithful to the resume.

Resume:
\"\"\"
{text}
\"\"\"
""".strip()


def _extract_json_object(content: str) -> dict[str, Any]:
    content = content.strip()
    if not content:
        raise ValueError("OpenAI response was empty.")

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("OpenAI response did not contain valid JSON.")
        return json.loads(content[start : end + 1])


def parse_resume_with_ai(text: str) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set. Add it to your environment or .env file.")

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)

    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": _build_prompt(text),
                    }
                ],
            }
        ],
    )

    raw_output = response.output_text
    try:
        structured = _extract_json_object(raw_output)
        validated = ResumeProfile.model_validate(structured)
    except (ValueError, ValidationError) as exc:
        raise ValueError(f"Unable to validate parsed resume JSON: {exc}") from exc

    return validated.model_dump()
