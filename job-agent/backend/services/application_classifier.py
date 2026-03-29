from __future__ import annotations

from urllib.parse import urlparse


DIRECT_HOST_PATTERNS = {
    "greenhouse": ("greenhouse.io", "boards.greenhouse.io"),
    "lever": ("lever.co", "jobs.lever.co"),
    "workable": ("workable.com", "apply.workable.com"),
    "ashby": ("ashbyhq.com", "jobs.ashbyhq.com"),
}


def detect_ats_provider(url: str) -> str:
    lowered = url.lower()
    if "gh_jid=" in lowered:
        return "greenhouse"
    for provider, patterns in DIRECT_HOST_PATTERNS.items():
        if any(pattern in lowered for pattern in patterns):
            return provider
    return "other"


def classify_application_type(url: str) -> str:
    lowered = url.lower()
    provider = detect_ats_provider(url)
    if provider != "other":
        return "direct"
    if any(token in lowered for token in ("login", "register", "signin", "sign-in", "auth")):
        return "auth_required"
    return "redirect"
