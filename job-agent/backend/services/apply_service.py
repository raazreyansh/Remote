from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from dotenv import load_dotenv
from playwright.sync_api import Error, Locator, Page, TimeoutError, sync_playwright

from backend.models.db import PROJECT_ROOT
from backend.models.job import Job
from backend.services.application_classifier import classify_application_type, detect_ats_provider

load_dotenv(PROJECT_ROOT / ".env")

FIELD_MAPPING = {
    "full_name": ["name", "full_name", "fullname", "candidate_name"],
    "email": ["email", "email_address"],
    "cover_letter": ["cover", "cover_letter", "message", "additional_info", "additional information"],
    "resume_upload": ["resume", "cv", "upload", "attachment"],
}
APPLY_LINK_SELECTORS = [
    "a:has-text('Apply')",
    "a:has-text('Apply now')",
    "a:has-text('Easy Apply')",
    "button:has-text('Apply')",
    "button:has-text('Apply now')",
]


def _job_value(job: Job | dict[str, Any], field: str) -> str:
    if isinstance(job, Job):
        return str(getattr(job, field, ""))
    return str(job.get(field, ""))


def _fill_locator(locator: Locator | None, value: str) -> bool:
    if locator is None or not value:
        return False
    try:
        locator.fill(value)
        return True
    except Error:
        try:
            locator.click()
            locator.press_sequentially(value)
            return True
        except Error:
            return False


def _goto_application_destination(page: Page, job_url: str) -> str:
    page.goto(job_url, wait_until="domcontentloaded")
    page.wait_for_load_state("domcontentloaded")

    if detect_ats_provider(page.url) == "ashby" and not page.url.rstrip("/").endswith("/application"):
        direct_application_url = page.url.rstrip("/") + "/application"
        page.goto(direct_application_url, wait_until="domcontentloaded")
        page.wait_for_load_state("domcontentloaded")
        return page.url

    for selector in APPLY_LINK_SELECTORS:
        locator = page.locator(selector).first
        try:
            if locator.count() == 0:
                continue
            tag_name = locator.evaluate("node => node.tagName.toLowerCase()")
            if tag_name == "a":
                href = locator.get_attribute("href")
                if href:
                    absolute_url = href if href.startswith("http") else urljoin(page.url, href)
                    page.goto(absolute_url, wait_until="domcontentloaded")
                    page.wait_for_load_state("domcontentloaded")
                    return page.url
            locator.click()
            page.wait_for_load_state("domcontentloaded")
            return page.url
        except (Error, TimeoutError):
            continue

    return page.url


def _field_metadata(locator: Locator) -> str:
    parts = []
    for attr in ("name", "id", "placeholder", "aria-label"):
        try:
            value = locator.get_attribute(attr) or ""
        except Error:
            value = ""
        if value:
            parts.append(value.lower())

    try:
        label_id = locator.get_attribute("id")
        if label_id:
            label = locator.page.locator(f"label[for='{label_id}']").first
            if label.count() > 0:
                parts.append(label.inner_text().lower())
    except Error:
        pass

    try:
        parts.append(locator.evaluate("node => (node.closest('label')?.innerText || '').toLowerCase()"))
    except Error:
        pass

    return " ".join(parts)


def _candidate_fields(page: Page, selector: str) -> list[Locator]:
    try:
        count = page.locator(selector).count()
    except Error:
        return []
    return [page.locator(selector).nth(index) for index in range(count)]


def _detect_fields(page: Page) -> dict[str, Locator | None]:
    result: dict[str, Locator | None] = {key: None for key in FIELD_MAPPING}
    candidates = (
        _candidate_fields(page, "input[type='text'], input[type='email'], input[type='file'], textarea, [contenteditable='true']")
    )

    for field_name, aliases in FIELD_MAPPING.items():
        for locator in candidates:
            metadata = _field_metadata(locator)
            if any(alias in metadata for alias in aliases):
                result[field_name] = locator
                break

    return result


def apply_to_job(
    job: Job | dict[str, Any],
    resume_path: str | Path,
    cover_letter: str,
    pause_for_review: bool = True,
) -> dict[str, Any]:
    applicant_name = os.getenv("APPLICANT_NAME", "")
    applicant_email = os.getenv("APPLICANT_EMAIL", "")
    job_url = _job_value(job, "url")
    resolved_resume_path = Path(resume_path)

    result = {
        "job_title": _job_value(job, "title"),
        "job_url": job_url,
        "application_url": job_url,
        "ats_provider": detect_ats_provider(job_url),
        "application_type": classify_application_type(job_url),
        "filled_fields": [],
        "missing_fields": [],
        "status": "opened",
        "submit_action": "manual_review_required",
    }

    if result["application_type"] != "direct":
        result["status"] = "manual_required"
        print(f"Skipping auto apply for non-direct job URL: {job_url}")
        return result

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_default_timeout(15000)

        try:
            result["application_url"] = _goto_application_destination(page, job_url)
            if classify_application_type(page.url) != "direct":
                result["status"] = "blocked"
                print(f"Blocked by non-direct destination: {page.url}")
                return result

            page.wait_for_timeout(2500)
            fields = _detect_fields(page)

            if _fill_locator(fields["full_name"], applicant_name):
                result["filled_fields"].append("full_name")
            else:
                result["missing_fields"].append("full_name")

            if _fill_locator(fields["email"], applicant_email):
                result["filled_fields"].append("email")
            else:
                result["missing_fields"].append("email")

            if fields["cover_letter"] is not None and cover_letter:
                if _fill_locator(fields["cover_letter"], cover_letter):
                    result["filled_fields"].append("cover_letter")
                else:
                    result["missing_fields"].append("cover_letter")
            else:
                result["missing_fields"].append("cover_letter")

            if fields["resume_upload"] is not None and resolved_resume_path.exists():
                try:
                    fields["resume_upload"].set_input_files(str(resolved_resume_path))
                    result["filled_fields"].append("resume_upload")
                except Error:
                    result["missing_fields"].append("resume_upload")
            else:
                result["missing_fields"].append("resume_upload")

            if {"full_name", "email", "cover_letter", "resume_upload"}.issubset(set(result["filled_fields"])):
                result["status"] = "ready_for_submit"
            elif result["filled_fields"]:
                result["status"] = "partially_filled"
            else:
                result["status"] = "blocked"

            print("Application page opened for manual review.")
            print(f"Current URL: {page.url}")
            print(f"Filled fields: {', '.join(result['filled_fields']) or 'none'}")
            print(f"Missing fields: {', '.join(result['missing_fields']) or 'none'}")
            print("Submit was not clicked. Review the browser manually.")
            if pause_for_review:
                input("Press Enter after reviewing the page to close the browser...")
        finally:
            browser.close()

    return result
