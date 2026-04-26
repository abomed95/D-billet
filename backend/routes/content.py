"""
Public content routes used by the marketing and SEO pages.
"""
from datetime import date

from fastapi import APIRouter, HTTPException

from config import db

router = APIRouter(tags=["Public Content"])

DEFAULT_TERMS_CONTENT = """# Conditions d'utilisation
## 1. Objet
D-Billet est la plateforme officielle de reservation en ligne pour les evenements, le train et le ferry a Djibouti.

## 2. Acces a la plateforme
L'acces a certains services peut necessiter la creation d'un compte ou l'identification de l'utilisateur. L'utilisateur s'engage a fournir des informations exactes et a jour.

## 3. Reservation et disponibilite
Les billets, places et traversées sont proposes sous reserve de disponibilite. Une reservation n'est consideree comme valide qu'apres confirmation du paiement et emission du billet.

## 4. Paiement
Le paiement s'effectue avec les moyens proposes sur la plateforme, notamment Waafi, D-Money et CAC Bank selon le service disponible. Le client verifie les informations de sa commande avant validation.

## 5. Billet numerique et QR code
Chaque billet emis contient les informations essentielles de la reservation ainsi qu'un QR code unique. Le billet doit etre conserve par l'utilisateur et presente lors du controle ou de l'embarquement.

## 6. Annulation, modification et remboursement
Les conditions d'annulation, de modification ou de remboursement dependent du service reserve, de l'organisateur ou de l'operateur concerne. Certaines commandes peuvent etre non remboursables une fois confirmees.

## 7. Controle et piece d'identite
L'organisateur, l'operateur de transport ou le personnel autorise peut demander le billet et une piece d'identite afin de verifier la validite de l'acces.

## 8. Responsabilite
D-Billet met en oeuvre les moyens raisonnables pour assurer la disponibilite de la plateforme et la fiabilite des informations diffusees. Toutefois, certaines informations restent de la responsabilite des organisateurs et operateurs partenaires.

## 9. Support client
Pour toute question relative a une reservation, un paiement ou un billet, contactez D-Billet a contact@d-billet.com ou au +253 77 69 48 12.
"""

DEFAULT_LEGAL_PAGES = {
    "mentions": {
        "title": "Mentions légales",
        "content": """# Mentions légales
## Éditeur
Le site D-Billet est exploité pour la commercialisation de billets et de réservations en ligne à Djibouti.

## Contact
Email : contact@d-billet.com
Téléphone : +253 77 69 48 12

## Responsabilité
D-Billet met en oeuvre les moyens raisonnables pour assurer la disponibilité du service et la fiabilité des informations diffusées par les organisateurs et opérateurs partenaires.
""",
    },
    "cgv": {
        "title": "Conditions générales de vente",
        "content": """# Conditions générales de vente
## Tarifs
Les prix affichés sur D-Billet sont indiqués en franc djiboutien, sauf mention contraire.

## Confirmation de commande
Une commande est considérée comme validée une fois le paiement confirmé et le billet émis.

## Contrôle
Le billet et le justificatif d'identité peuvent être demandés lors du contrôle d'accès ou de l'embarquement.

## Réclamations
Toute demande relative à une commande doit être transmise au support D-Billet avec les références utiles.
""",
    },
    "privacy": {
        "title": "Politique de confidentialité",
        "content": """# Politique de confidentialité
## Données collectées
D-Billet collecte les informations nécessaires à la création de compte, à la réservation et au support client.

## Finalités
Les données servent à émettre les billets, vérifier les paiements, contacter les voyageurs ou participants et assurer la sécurité de la plateforme.

## Conservation
Les données sont conservées pendant la durée nécessaire aux obligations contractuelles, comptables et de support.

## Contact
Pour exercer vos droits ou poser une question sur vos données, contactez contact@d-billet.com.
""",
    },
    "support": {
        "title": "Support client",
        "content": """# Support client
## Assistance
L'équipe D-Billet accompagne les clients pour les billets, réservations, paiements et accès aux événements.

## Disponibilité
Le support traite les demandes dans les meilleurs délais selon la disponibilité des équipes.

## Coordonnées
Email : contact@d-billet.com
Téléphone : +253 77 69 48 12
""",
    },
}

DEFAULT_TESTIMONIALS = [
    {
        "author": "Amina H.",
        "role": "Cliente D-BILLET",
        "content": "J'ai reserve mon billet en quelques minutes et tout s'est deroule sans attente a l'entree.",
        "rating": 5,
    },
    {
        "author": "Moussa A.",
        "role": "Voyageur ferry",
        "content": "La reservation en ligne m'a permis d'organiser mon depart plus sereinement, avec mon billet deja pret.",
        "rating": 5,
    },
    {
        "author": "Noura S.",
        "role": "Participante evenement",
        "content": "Le paiement etait simple, les informations etaient claires et le QR code a ete recu immediatement.",
        "rating": 5,
    },
]

DEFAULT_NEWS = [
    {
        "title": "Billetterie en ligne a Djibouti",
        "excerpt": "D-Billet centralise les reservations d'evenements, de ferry et de train sur une meme plateforme.",
        "content": "D-Billet propose une experience de reservation en ligne pour les principales sorties et mobilites du pays.",
        "image_url": None,
    }
]


def _read_platform_text(settings: dict, *keys: str) -> str | None:
    for key in keys:
        value = settings.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _normalize_testimonial(document: dict) -> dict:
    return {
        "author": document.get("author") or document.get("author_name") or "Client D-Billet",
        "role": document.get("role") or document.get("author_role") or "Utilisateur",
        "content": document.get("content") or "",
        "rating": document.get("rating") or 5,
        "avatar_url": document.get("avatar_url"),
    }


def _normalize_news(document: dict) -> dict:
    return {
        "title": document.get("title") or "Actualite D-Billet",
        "excerpt": document.get("excerpt") or document.get("content") or "",
        "content": document.get("content") or document.get("excerpt") or "",
        "image_url": document.get("image_url"),
    }


@router.get("/testimonials")
async def get_public_testimonials():
    testimonials = await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    if not testimonials:
        return DEFAULT_TESTIMONIALS
    return [_normalize_testimonial(testimonial) for testimonial in testimonials]


@router.get("/news")
async def get_public_news():
    news_items = await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    if not news_items:
        return DEFAULT_NEWS
    return [_normalize_news(item) for item in news_items]


@router.get("/terms")
async def get_public_terms():
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0}) or {}
    content = _read_platform_text(settings, "terms_content", "terms") or DEFAULT_TERMS_CONTENT

    return {
        "title": "Conditions d'utilisation",
        "content": content,
        "last_updated": settings.get("updated_at") or date.today().isoformat(),
    }


@router.get("/legal/{page}")
async def get_public_legal_page(page: str):
    page_key = page.lower()
    if page_key not in DEFAULT_LEGAL_PAGES:
        raise HTTPException(status_code=404, detail="Page legale non trouvee")

    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0}) or {}
    default_page = DEFAULT_LEGAL_PAGES[page_key]
    legal_pages = settings.get("legal_pages") if isinstance(settings.get("legal_pages"), dict) else {}
    stored_page = legal_pages.get(page_key) if isinstance(legal_pages.get(page_key), dict) else {}

    content = (
        stored_page.get("content")
        or (
            _read_platform_text(settings, "legal_content", "legal")
            if page_key == "mentions"
            else None
        )
        or default_page["content"]
    )
    title = stored_page.get("title") or default_page["title"]

    return {
        "title": title,
        "content": content,
        "last_updated": settings.get("updated_at") or date.today().isoformat(),
    }
