from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.models.db import PROJECT_ROOT


class ProfilePayload(BaseModel):
    skills: list[str] = Field(default_factory=list)
    experience: list[dict[str, Any] | str] = Field(default_factory=list)
    projects: list[dict[str, Any] | str] = Field(default_factory=list)
    education: list[dict[str, Any] | str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    preferred_locations: list[str] = Field(default_factory=list)

    @field_validator("skills", "roles")
    @classmethod
    def _ensure_non_empty_strings(cls, values: list[str]) -> list[str]:
        cleaned = [str(value).strip() for value in values if str(value).strip()]
        if not cleaned:
            raise ValueError("must contain at least one non-empty value")
        return cleaned

    @field_validator("experience")
    @classmethod
    def _ensure_experience_present(cls, values: list[dict[str, Any] | str]) -> list[dict[str, Any] | str]:
        if not values:
            raise ValueError("must contain at least one experience entry")
        return values


def get_profile_path(profile_path: str | Path = "data/profile.json") -> Path:
    resolved_path = Path(profile_path)
    if not resolved_path.is_absolute():
        resolved_path = PROJECT_ROOT / resolved_path
    return resolved_path


def load_profile(profile_path: str | Path = "data/profile.json") -> dict[str, Any]:
    resolved_path = get_profile_path(profile_path)
    if not resolved_path.exists():
        raise FileNotFoundError(f"Profile JSON not found: {resolved_path}")

    raw_profile = json.loads(resolved_path.read_text(encoding="utf-8-sig"))
    try:
        validated_profile = ProfilePayload.model_validate(raw_profile)
    except ValidationError as exc:
        raise ValueError(f"Invalid profile data in {resolved_path}: {exc}") from exc

    return validated_profile.model_dump()


def save_profile(profile: dict[str, Any], profile_path: str | Path = "data/profile.json") -> dict[str, Any]:
    validated_profile = ProfilePayload.model_validate(profile)
    resolved_path = get_profile_path(profile_path)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_path.write_text(
        json.dumps(validated_profile.model_dump(), indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    return validated_profile.model_dump()
