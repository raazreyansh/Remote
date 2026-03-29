from __future__ import annotations

import hashlib
import json
import os
from functools import lru_cache

from dotenv import load_dotenv
from openai import OpenAI
from openai import OpenAIError
from sentence_transformers import SentenceTransformer
from sqlalchemy import select

from backend.models.db import PROJECT_ROOT, SessionLocal
from backend.models.job import Job
from backend.models.profile_embedding import ProfileEmbedding

load_dotenv(PROJECT_ROOT / ".env")


def _normalize_text(text: str) -> str:
    return " ".join(text.split())


def _hash_text(text: str) -> str:
    return hashlib.sha256(_normalize_text(text).encode("utf-8")).hexdigest()


@lru_cache(maxsize=1)
def _openai_client() -> OpenAI | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or os.getenv("USE_EMBEDDINGS", "true").lower() != "true":
        return None
    return OpenAI(api_key=api_key)


@lru_cache(maxsize=1)
def _openai_embedding_model() -> str:
    return os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")


@lru_cache(maxsize=1)
def _local_model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")


def get_openai_embedding(text: str) -> tuple[list[float] | None, str | None]:
    client = _openai_client()
    if client is None or not text.strip():
        return None, None

    try:
        response = client.embeddings.create(model=_openai_embedding_model(), input=text)
    except OpenAIError as exc:
        print(f"Warning: OpenAI embeddings unavailable, falling back locally. Reason: {exc}")
        return None, None

    return response.data[0].embedding, "openai"


def get_local_embedding(text: str) -> tuple[list[float] | None, str | None]:
    if not text.strip():
        return None, None
    vector = _local_model().encode(text, normalize_embeddings=True)
    return vector.tolist(), "local"


def get_embedding_with_fallback(text: str) -> tuple[list[float] | None, str]:
    normalized = _normalize_text(text)
    if not normalized:
        return None, "keyword"

    embedding, source = get_openai_embedding(normalized)
    if embedding is not None and source:
        return embedding, source

    embedding, source = get_local_embedding(normalized)
    if embedding is not None and source:
        return embedding, source

    return None, "keyword"


def get_or_create_profile_embedding(text: str) -> tuple[list[float] | None, str]:
    profile_hash = _hash_text(text)
    with SessionLocal() as session:
        cached = session.get(ProfileEmbedding, profile_hash)
        if cached:
            return json.loads(cached.embedding), cached.source

    embedding, source = get_embedding_with_fallback(text)
    if embedding is None:
        return None, source

    with SessionLocal() as session:
        cached = session.get(ProfileEmbedding, profile_hash)
        if cached is None:
            cached = ProfileEmbedding(profile_hash=profile_hash, embedding=json.dumps(embedding), source=source)
            session.add(cached)
        else:
            cached.embedding = json.dumps(embedding)
            cached.source = source
        session.commit()

    return embedding, source


def get_or_create_job_embedding(job: Job, text: str) -> tuple[list[float] | None, str]:
    if job.job_embedding:
        return json.loads(job.job_embedding), job.embedding_source

    embedding, source = get_embedding_with_fallback(text)
    if embedding is None:
        return None, source

    with SessionLocal() as session:
        managed_job = session.get(Job, job.id)
        if managed_job is None:
            return embedding, source
        managed_job.job_embedding = json.dumps(embedding)
        managed_job.embedding_source = source
        session.commit()

    job.job_embedding = json.dumps(embedding)
    job.embedding_source = source
    return embedding, source
