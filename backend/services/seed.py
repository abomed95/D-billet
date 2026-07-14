"""
Demo/local data seeding helpers.
"""
from datetime import datetime, timezone
import uuid

from config import db
from .auth import hash_password
from .seo import slugify

DEMO_ADMIN = {
    "email": "admin@dbillet.dj",
    "password": "admin123",
    "full_name": "Administrateur D-Billet",
    "phone": "+25377000001",
    "role": "admin",
}

DEMO_ORGANIZER = {
    "email": "organizer@dbillet.dj",
    "password": "organizer123",
    "full_name": "Organisateur Demo",
    "phone": "+25377000002",
    "role": "organizer",
    "company_name": "D-Billet Events",
}

DEMO_FERRY_ORGANIZER = {
    "email": "ferry.organizer@dbillet.dj",
    "password": "ferry123",
    "full_name": "Organisateur Ferry Demo",
    "phone": "+25377000003",
    "role": "ferry_organizer",
    "company_name": "D-Billet Ferry",
}

DEMO_TRAIN_ORGANIZER = {
    "email": "train.organizer@dbillet.dj",
    "password": "train123",
    "full_name": "Organisateur Train Demo",
    "phone": "+25377000004",
    "role": "train_organizer",
    "company_name": "D-Billet Train",
}

DEMO_EVENT = {
    "title": "Festival D-Billet Live",
    "description": "Evenement de demonstration pour verifier rapidement la plateforme locale.",
    "category": "concerts",
    "venue": "Palais du Peuple, Djibouti",
    "date": "2026-06-20",
    "time": "20:00",
    "image_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    "featured": True,
    "status": "approved",
    "ticket_types": [
        {
            "id": "demo-vip-ticket",
            "name": "VIP",
            "price": 5000,
            "quantity": 50,
            "sold": 0,
            "description": "Acces VIP",
            "max_per_order": 10,
            "group_size": 1,
        },
        {
            "id": "demo-standard-ticket",
            "name": "Standard",
            "price": 2000,
            "quantity": 300,
            "sold": 0,
            "description": "Billet standard",
            "max_per_order": 10,
            "group_size": 1,
        },
    ],
}


async def upsert_demo_user(user_data: dict) -> dict:
    """Create or reset a demo user account to a known password/role."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})

    user_id = existing.get("id") if existing else str(uuid.uuid4())
    payload = {
        "id": user_id,
        "email": user_data["email"],
        "phone": user_data.get("phone"),
        "full_name": user_data["full_name"],
        "hashed_password": hash_password(user_data["password"]),
        "role": user_data["role"],
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
    }

    if user_data.get("company_name"):
        payload["company_name"] = user_data["company_name"]

    await db.users.update_one(
        {"email": user_data["email"]},
        {"$set": payload},
        upsert=True,
    )

    stored = payload.copy()
    stored.pop("hashed_password", None)
    return stored


async def ensure_demo_event(organizer_id: str) -> dict:
    """Ensure one organizer-owned demo event exists for local verification."""
    existing = await db.events.find_one({"title": DEMO_EVENT["title"]}, {"_id": 0})
    if existing:
        return {"event_id": existing["id"], "created": False}

    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    event_doc = {
        "id": event_id,
        "slug": f"{slugify(DEMO_EVENT['title'])}-{event_id[:8]}",
        "title": DEMO_EVENT["title"],
        "description": DEMO_EVENT["description"],
        "category": DEMO_EVENT["category"],
        "venue": DEMO_EVENT["venue"],
        "date": DEMO_EVENT["date"],
        "time": DEMO_EVENT["time"],
        "image_url": DEMO_EVENT["image_url"],
        "featured": DEMO_EVENT["featured"],
        "status": DEMO_EVENT["status"],
        "ticket_types": DEMO_EVENT["ticket_types"],
        "organizer_id": organizer_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.events.insert_one(event_doc)
    return {"event_id": event_id, "created": True}


async def seed_demo_data() -> dict:
    """
    Seed demo accounts and a sample event.
    Re-runnable: known demo credentials are reset to the expected values.
    """
    admin = await upsert_demo_user(DEMO_ADMIN)
    organizer = await upsert_demo_user(DEMO_ORGANIZER)
    ferry_organizer = await upsert_demo_user(DEMO_FERRY_ORGANIZER)
    train_organizer = await upsert_demo_user(DEMO_TRAIN_ORGANIZER)
    event_result = await ensure_demo_event(organizer["id"])

    return {
        "admin_email": DEMO_ADMIN["email"],
        "admin_password": DEMO_ADMIN["password"],
        "organizer_email": DEMO_ORGANIZER["email"],
        "organizer_password": DEMO_ORGANIZER["password"],
        "ferry_organizer_email": DEMO_FERRY_ORGANIZER["email"],
        "ferry_organizer_password": DEMO_FERRY_ORGANIZER["password"],
        "train_organizer_email": DEMO_TRAIN_ORGANIZER["email"],
        "train_organizer_password": DEMO_TRAIN_ORGANIZER["password"],
        "transport_organizers_seeded": [
            {
                "email": ferry_organizer["email"],
                "role": ferry_organizer["role"],
            },
            {
                "email": train_organizer["email"],
                "role": train_organizer["role"],
            },
        ],
        "event_id": event_result["event_id"],
        "event_created": event_result["created"],
    }
