"""
SEO helpers for slugs and public URLs
"""
import re
import unicodedata
from typing import Optional

from config import APP_URL, db


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug) or "event"


async def generate_unique_event_slug(title: str, event_id: str, exclude_event_id: Optional[str] = None) -> str:
    base_slug = slugify(title)
    slug = base_slug
    suffix = 2

    while True:
        query = {"slug": slug}
        if exclude_event_id:
            query["id"] = {"$ne": exclude_event_id}

        existing = await db.events.find_one(query, {"_id": 1})
        if not existing:
            return slug

        slug = f"{base_slug}-{suffix}"
        suffix += 1


async def ensure_event_slug(event: dict) -> dict:
    if event.get("slug"):
        return event

    slug = await generate_unique_event_slug(event.get("title", "event"), event["id"], exclude_event_id=event["id"])
    event["slug"] = slug
    await db.events.update_one({"id": event["id"]}, {"$set": {"slug": slug}})
    return event


def event_public_url(event: dict) -> str:
    return f"{APP_URL}/events/{event['id']}/{event['slug']}"
