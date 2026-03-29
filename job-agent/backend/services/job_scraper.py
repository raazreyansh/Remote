from __future__ import annotations

from typing import Any

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from backend.services.ats_ingestion import fetch_all_ats_jobs
from backend.services.application_target_service import enrich_job_with_application_target

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
DEFAULT_TIMEOUT = 20


def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(DEFAULT_HEADERS)
    return session


def _clean_text(value: str | None, default: str = "") -> str:
    if not value:
        return default
    return " ".join(value.split())


def _extract_remoteok_description(job_card: Any) -> str:
    text = job_card.get_text(" ", strip=True)
    return _clean_text(text)


def fetch_remoteok_jobs() -> list[dict[str, str]]:
    session = _build_session()
    response = session.get("https://remoteok.com/remote-dev-jobs", timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    jobs: list[dict[str, str]] = []

    for job_card in soup.select("tr.job"):
        anchor = job_card.select_one("a.preventLink, a[itemprop='url']")
        title = job_card.select_one("h2")
        company = job_card.select_one("h3")
        location = job_card.select_one(".location")

        href = anchor.get("href") if anchor else None
        if not href or not title or not company:
            continue

        absolute_url = href if href.startswith("http") else f"https://remoteok.com{href}"
        jobs.append(
            {
                "title": _clean_text(title.get_text()),
                "company": _clean_text(company.get_text()),
                "location": _clean_text(location.get_text() if location else None, default="Remote"),
                "url": absolute_url,
                "description": _extract_remoteok_description(job_card),
                "source": "RemoteOK",
            }
        )

    return jobs


def fetch_weworkremotely_jobs() -> list[dict[str, str]]:
    session = _build_session()
    response = session.get("https://weworkremotely.com/remote-jobs", timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    jobs: list[dict[str, str]] = []

    for article in soup.select("section.jobs article li"):
        if "view-all" in article.get("class", []):
            continue

        anchor = article.select_one("a.listing-link--unlocked[href], a[href*='/remote-jobs/']")
        company = article.select_one(".new-listing__company-name")
        title = article.select_one(".new-listing__header__title__text")
        location = article.select_one(".new-listing__company-headquarters")

        href = anchor.get("href") if anchor else None
        if not href or not company or not title:
            continue

        absolute_url = href if href.startswith("http") else f"https://weworkremotely.com{href}"
        jobs.append(
            {
                "title": _clean_text(title.get_text()),
                "company": _clean_text(company.get_text()),
                "location": _clean_text(location.get_text() if location else None, default="Remote"),
                "url": absolute_url,
                "description": _clean_text(article.get_text(" ", strip=True)),
                "source": "WeWorkRemotely",
            }
        )

    return jobs


def fetch_all_jobs(direct_only: bool = False, include_listing_sites: bool = True) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    errors: list[str] = []

    ats_jobs = fetch_all_ats_jobs()
    jobs.extend(ats_jobs)

    if not include_listing_sites and direct_only:
        return jobs

    if include_listing_sites:
        for source_name, fetcher in (
            ("RemoteOK", fetch_remoteok_jobs),
            ("WeWorkRemotely", fetch_weworkremotely_jobs),
        ):
            try:
                jobs.extend(fetcher())
            except requests.RequestException as exc:
                errors.append(f"{source_name}: {exc}")

    if not jobs and errors:
        raise RuntimeError("All job sources failed. " + "; ".join(errors))

    for error in errors:
        print(f"Warning: {error}")

    if direct_only:
        enriched_jobs: list[dict[str, str]] = []
        for job in jobs:
            if job.get("application_type") == "direct":
                enriched_jobs.append(job)
                continue
            resolved_job = enrich_job_with_application_target(job)
            if resolved_job["application_type"] == "direct":
                enriched_jobs.append(resolved_job)
        return enriched_jobs

    return jobs
