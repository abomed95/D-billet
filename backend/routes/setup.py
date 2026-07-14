"""
Setup and demo data bootstrap routes.
"""
from fastapi import APIRouter, HTTPException

from config import ALLOW_PUBLIC_SEED_ROUTE
from services import seed_demo_data

router = APIRouter(tags=["Setup"])


@router.post("/seed")
async def seed_database():
    """
    Seed demo data in local/dev environments.
    Disabled by default outside local/dev/test to avoid exposing a public bootstrap.
    """
    if not ALLOW_PUBLIC_SEED_ROUTE:
        raise HTTPException(status_code=403, detail="Seed public desactive sur cet environnement")

    result = await seed_demo_data()
    return {
        "message": "Donnees de demo initialisees",
        **result,
    }
