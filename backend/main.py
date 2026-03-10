"""
D-Billet API - Billetterie Djibouti
Main application entry point
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path

from routes import (
    auth_router,
    events_router,
    cart_router,
    tickets_router,
    transport_router,
    staff_router,
    organizer_router,
    admin_router
)

app = FastAPI(
    title="D-Billet API",
    description="Plateforme de billetterie pour Djibouti - Evenements, Train & Ferry",
    version="2.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
UPLOAD_DIR = Path("/app/frontend/public/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include all routers under /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(tickets_router, prefix="/api")
app.include_router(transport_router, prefix="/api")
app.include_router(staff_router, prefix="/api")
app.include_router(organizer_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "D-Billet API",
        "version": "2.0.0",
        "description": "Plateforme de billetterie Djibouti"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "D-Billet API"}
