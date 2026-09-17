"""
Create (or update) the first administrator account.

Production never seeds demo accounts, so the very first admin has to be
created explicitly. On the Droplet this runs over SSH; on Cloud Run there is
no SSH, so it runs as a Cloud Run Job built from the same image:

    gcloud run jobs execute dbillet-create-admin --region <region> --wait

Reads its input from the environment:
    ADMIN_EMAIL     (required)
    ADMIN_PASSWORD  (required, 12 characters minimum)
    ADMIN_FULL_NAME (default: "Administrateur")
    ADMIN_PHONE     (default: "+25377000000")

Idempotent: re-running it resets the password of the existing account
instead of creating a duplicate.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

from config import db
from services.auth import hash_password

MIN_PASSWORD_LENGTH = 12


async def main() -> int:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    full_name = os.environ.get("ADMIN_FULL_NAME", "Administrateur").strip()
    phone = os.environ.get("ADMIN_PHONE", "+25377000000").strip()

    if not email or "@" not in email:
        print("ADMIN_EMAIL is required and must be a valid address", file=sys.stderr)
        return 2
    if len(password) < MIN_PASSWORD_LENGTH:
        print(
            f"ADMIN_PASSWORD is required ({MIN_PASSWORD_LENGTH} characters minimum)",
            file=sys.stderr,
        )
        return 2

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.users.find_one({"email": email}, {"_id": 0})

    payload = {
        "id": existing.get("id") if existing else str(uuid.uuid4()),
        "email": email,
        "phone": phone,
        "full_name": full_name,
        "hashed_password": hash_password(password),
        "role": "admin",
        "created_at": existing.get("created_at", now) if existing else now,
        "updated_at": now,
    }

    await db.users.update_one({"email": email}, {"$set": payload}, upsert=True)

    action = "updated (password reset)" if existing else "created"
    print(f"Admin account {action}: {email}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
