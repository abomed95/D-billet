"""
SEO routes
"""
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import Response

from config import db
from services import event_public_url, ensure_event_slug

router = APIRouter(tags=["SEO"])


@router.get("/sitemap-events.xml", include_in_schema=False)
async def sitemap_events():
    query = {
        "$or": [
            {"status": {"$exists": False}},
            {"status": "approved"},
        ]
    }
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(5000)

    url_entries = []
    for event in events:
        event = await ensure_event_slug(event)
        lastmod = event.get("updated_at") or event.get("created_at")
        lastmod_xml = f"\n    <lastmod>{escape(lastmod)}</lastmod>" if lastmod else ""
        url_entries.append(
            "  <url>\n"
            f"    <loc>{escape(event_public_url(event))}</loc>"
            f"{lastmod_xml}\n"
            "    <changefreq>daily</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{chr(10).join(url_entries)}\n"
        '</urlset>'
    )
    return Response(content=xml, media_type="application/xml")
