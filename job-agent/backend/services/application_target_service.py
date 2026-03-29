from __future__ import annotations

from typing import Any

import requests
from bs4 import BeautifulSoup

from backend.services.application_classifier import classify_application_type, detect_ats_provider

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )
}
DIRECT_PATTERNS = ("greenhouse", "lever", "workable", "ashby")


def resolve_application_target(url: str, timeout: int = 20) -> dict[str, str]:
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException:
        provider = detect_ats_provider(url)
        return {
            "final_url": url,
            "application_type": classify_application_type(url),
            "ats_provider": provider,
        }

    final_url = response.url
    provider = detect_ats_provider(final_url)
    application_type = classify_application_type(final_url)

    if application_type != "direct":
        soup = BeautifulSoup(response.text, "html.parser")
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if any(pattern in href.lower() for pattern in DIRECT_PATTERNS):
                final_url = href
                provider = detect_ats_provider(final_url)
                application_type = classify_application_type(final_url)
                break

    return {
        "final_url": final_url,
        "application_type": application_type,
        "ats_provider": provider,
    }


def enrich_job_with_application_target(job_data: dict[str, Any]) -> dict[str, Any]:
    resolved = resolve_application_target(str(job_data["url"]))
    return {
        **job_data,
        "url": resolved["final_url"],
        "application_type": resolved["application_type"],
        "ats_provider": resolved["ats_provider"],
    }
