from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def fetch_ashby_jobs(company_slug: str) -> list[dict[str, Any]]:
    board_url = f"https://jobs.ashbyhq.com/{company_slug}"
    jobs: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(board_url, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        anchors = page.locator("a[href]").all()
        seen_urls: set[str] = set()
        for anchor in anchors:
            href = anchor.get_attribute("href") or ""
            text = _clean_text(anchor.inner_text())
            if not href:
                continue
            absolute_url = href if href.startswith("http") else urljoin(board_url, href)
            if "/job/" not in absolute_url and company_slug not in absolute_url.lower():
                continue
            if absolute_url in seen_urls:
                continue
            seen_urls.add(absolute_url)
            if not text:
                continue
            jobs.append(
                {
                    "title": text,
                    "company": company_slug,
                    "location": "Remote",
                    "description": text,
                    "url": absolute_url,
                    "source": "ashby",
                    "application_type": "direct",
                    "ats_provider": "ashby",
                }
            )

        browser.close()

    return jobs
