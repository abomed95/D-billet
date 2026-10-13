"""
Tests des correctifs de securite (audit d'octobre 2026).

Autonomes : base JSON locale temporaire, aucun serveur, aucun appel reseau.

    cd backend && pytest tests/test_security_fixes.py -v
"""
import asyncio
import os
import sys
import tempfile
import uuid

import pytest

os.environ["APP_ENV"] = "development"
os.environ["AUTO_SEED_DEMO_DATA"] = "false"
for _var in (
    "WAAFIPAY_MERCHANT_UID", "WAAFIPAY_STORE_ID", "WAAFIPAY_HPP_KEY",
    "WAAFIPAY_API_USER_ID", "WAAFIPAY_API_KEY", "ALLOW_SIMULATED_PAYMENTS",
):
    os.environ.pop(_var, None)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient  # noqa: E402

import config  # noqa: E402
from localdb import LocalAsyncDatabase  # noqa: E402

PASSWORD = "Motdepasse-Solide-1"


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def env(monkeypatch):
    """App + base JSON vierge, rebranchee dans tous les modules qui ont capture `db`."""
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp.close()
    db = LocalAsyncDatabase(tmp.name)

    import main
    import services.auth as services_auth
    import services.payments as services_payments
    import routes.auth as routes_auth
    import routes.cart as routes_cart
    import routes.tickets as routes_tickets
    import routes.staff as routes_staff

    for module in (config, services_auth, services_payments, routes_auth,
                   routes_cart, routes_tickets, routes_staff):
        monkeypatch.setattr(module, "db", db, raising=False)
    monkeypatch.setattr(config, "ALLOW_SIMULATED_PAYMENTS", False, raising=False)

    # Le rate limiter est en memoire : on le remet a zero entre les tests.
    import services.rate_limit as rate_limit
    for name in ("_buckets", "_BUCKETS", "_hits", "_requests"):
        store = getattr(rate_limit, name, None)
        if hasattr(store, "clear"):
            store.clear()

    client = TestClient(main.app)
    yield client, db
    try:
        os.unlink(tmp.name)
    except OSError:
        pass


def make_user(db, *, role="user", email=None, phone=None, password=None, **extra):
    from services.auth import hash_password
    user = {
        "id": str(uuid.uuid4()),
        "full_name": "Test " + role,
        "role": role,
        "email": email,
        "phone": phone,
        **extra,
    }
    if password:
        user["hashed_password"] = hash_password(password)
    run(db.users.insert_one(user))
    return user


def token_for(user):
    from services.auth import create_access_token
    return create_access_token({"sub": user["id"]})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------ #
# 1. Connexion : le mot de passe est toujours obligatoire
# ------------------------------------------------------------------ #

def test_login_sans_mot_de_passe_est_refuse(env):
    client, db = env
    make_user(db, role="admin", email="admin@exemple.dj", password=PASSWORD)

    r = client.post("/api/auth/login", json={"email": "admin@exemple.dj"})
    assert r.status_code == 401
    assert "access_token" not in r.text


def test_login_mauvais_mot_de_passe_est_refuse(env):
    client, db = env
    make_user(db, email="u@exemple.dj", password=PASSWORD)
    r = client.post("/api/auth/login", json={"email": "u@exemple.dj", "password": "faux"})
    assert r.status_code == 401


def test_login_bon_mot_de_passe_fonctionne(env):
    client, db = env
    make_user(db, email="u@exemple.dj", password=PASSWORD)
    r = client.post("/api/auth/login", json={"email": "u@exemple.dj", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_compte_sans_mot_de_passe_ne_passe_pas(env):
    """Compte Google ou telephone seul : aucun mot de passe => pas de connexion par /login."""
    client, db = env
    make_user(db, email="g@exemple.dj", auth_provider="google")
    assert client.post("/api/auth/login", json={"email": "g@exemple.dj"}).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": "g@exemple.dj", "password": "x"}
    ).status_code == 401


def test_login_message_identique_compte_inconnu(env):
    client, db = env
    make_user(db, email="u@exemple.dj", password=PASSWORD)
    inconnu = client.post("/api/auth/login", json={"email": "nul@exemple.dj", "password": "x"})
    faux = client.post("/api/auth/login", json={"email": "u@exemple.dj", "password": "x"})
    assert inconnu.status_code == faux.status_code == 401
    assert inconnu.json() == faux.json()


# ------------------------------------------------------------------ #
# 2. Telephone / invite : pas de prise de controle des comptes proteges
# ------------------------------------------------------------------ #

@pytest.mark.parametrize("kwargs", [
    {"role": "admin", "phone": "77000001", "email": "a@exemple.dj", "password": PASSWORD},
    {"role": "organizer", "phone": "77000002"},
    {"role": "user", "phone": "77000003", "email": "c@exemple.dj", "password": PASSWORD},
    {"role": "user", "phone": "77000004", "auth_provider": "google", "email": "g@exemple.dj"},
])
def test_phone_login_refuse_pour_comptes_proteges(env, kwargs):
    client, db = env
    make_user(db, **kwargs)
    r = client.post("/api/auth/phone-login", json={"phone": kwargs["phone"]})
    assert r.status_code == 403
    assert "access_token" not in r.text


@pytest.mark.parametrize("kwargs", [
    {"role": "admin", "phone": "77000011", "email": "a@exemple.dj", "password": PASSWORD},
    {"role": "organizer", "phone": "77000012"},
    {"role": "user", "phone": "77000013", "email": "c@exemple.dj", "password": PASSWORD},
])
def test_guest_session_refuse_pour_comptes_proteges(env, kwargs):
    client, db = env
    make_user(db, **kwargs)
    r = client.post("/api/auth/guest-session",
                    json={"phone": kwargs["phone"], "full_name": "Pirate"})
    assert r.status_code == 403
    assert "token" not in r.json()


def test_phone_login_et_invite_creent_un_nouveau_compte(env):
    client, _ = env
    r = client.post("/api/auth/phone-login", json={"phone": "77111111", "full_name": "Nouveau"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "user"
    r = client.post("/api/auth/guest-session", json={"phone": "77222222", "full_name": "Invite"})
    assert r.status_code == 200 and r.json()["is_new"] is True


# ------------------------------------------------------------------ #
# 3 & 4. Quantite negative et paiement ferme par defaut
# ------------------------------------------------------------------ #

def make_event(db, organizer_id, *, price=5000, quantity=100, sold=0):
    event = {
        "id": str(uuid.uuid4()),
        "title": "Concert test",
        "date": "2030-01-01", "time": "20:00", "venue": "Palais",
        "organizer_id": organizer_id,
        "ticket_types": [{
            "id": str(uuid.uuid4()), "name": "Standard", "price": price,
            "quantity": quantity, "sold": sold, "max_per_order": 10,
        }],
    }
    run(db.events.insert_one(event))
    return event


@pytest.mark.parametrize("qty", [0, -1, -45, 51])
def test_quantite_invalide_refusee_a_l_ajout_au_panier(env, qty):
    client, db = env
    client_user = make_user(db, phone="77300000")
    event = make_event(db, "org")
    r = client.post("/api/cart/add", headers=auth(token_for(client_user)), json={
        "event_id": event["id"],
        "ticket_type_id": event["ticket_types"][0]["id"],
        "quantity": qty,
    })
    assert r.status_code == 422


def test_panier_falsifie_avec_quantite_negative_refuse_au_checkout(env, monkeypatch):
    client, db = env
    monkeypatch.setattr(config, "ALLOW_SIMULATED_PAYMENTS", True, raising=False)
    user = make_user(db, phone="77300001")
    event = make_event(db, "org")
    tt = event["ticket_types"][0]["id"]
    run(db.carts.insert_one({"user_id": user["id"], "items": [
        {"event_id": event["id"], "ticket_type_id": tt, "quantity": 10},
        {"event_id": event["id"], "ticket_type_id": tt, "quantity": -9},
    ]}))
    r = client.post("/api/checkout", headers=auth(token_for(user)),
                    json={"payment_method": "waafi"})
    assert r.status_code == 400
    assert run(db.tickets.count_documents({})) == 0


def _panier_valide(db, user, event, qty=2):
    run(db.carts.insert_one({"user_id": user["id"], "items": [{
        "event_id": event["id"],
        "ticket_type_id": event["ticket_types"][0]["id"],
        "quantity": qty,
    }]}))


def test_checkout_sans_passerelle_n_emet_aucun_billet(env):
    """WaafiPay absent + paiement simule non active => 503, zero billet."""
    client, db = env
    user = make_user(db, phone="77300002")
    event = make_event(db, "org")
    _panier_valide(db, user, event)
    r = client.post("/api/checkout", headers=auth(token_for(user)),
                    json={"payment_method": "n-importe-quoi"})
    assert r.status_code == 503
    assert run(db.tickets.count_documents({})) == 0
    assert run(db.events.find_one({"id": event["id"]}))["ticket_types"][0]["sold"] == 0


def test_paiement_simule_reste_possible_en_dev_si_active_explicitement(env, monkeypatch):
    client, db = env
    monkeypatch.setattr(config, "ALLOW_SIMULATED_PAYMENTS", True, raising=False)
    user = make_user(db, phone="77300003")
    event = make_event(db, "org")
    _panier_valide(db, user, event)
    r = client.post("/api/checkout", headers=auth(token_for(user)),
                    json={"payment_method": "waafi"})
    assert r.status_code == 200
    assert run(db.tickets.count_documents({})) == 2


def test_paiement_simule_jamais_actif_en_production():
    import subprocess
    code = (
        "import os, sys;"
        "sys.path.insert(0, sys.argv[1]);"
        "os.environ.update(APP_ENV='production', ALLOW_SIMULATED_PAYMENTS='true',"
        "JWT_SECRET='x'*40);"
        "import config; print(config.ALLOW_SIMULATED_PAYMENTS)"
    )
    out = subprocess.run([sys.executable, "-c", code, BACKEND_DIR], cwd=tempfile.gettempdir(),
                         capture_output=True, text=True)
    assert out.stdout.strip().endswith("False"), out.stderr


# ------------------------------------------------------------------ #
# 5. Scanner : acces restreint, atomique, vue publique sans donnees perso
# ------------------------------------------------------------------ #

def make_ticket(db, event, owner, *, status="valid", **extra):
    ticket = {
        "id": str(uuid.uuid4()),
        "event_id": event["id"], "event_title": event["title"],
        "event_date": event["date"], "event_time": event["time"],
        "event_venue": event["venue"], "ticket_type": "Standard",
        "user_id": owner["id"], "organizer_id": event["organizer_id"],
        "status": status, "price": 5000,
        "created_at": "2030-01-01T00:00:00+00:00",
        **extra,
    }
    ticket["qr_code_data"] = f"DBILLET-{ticket['id']}"
    run(db.tickets.insert_one(ticket))
    return ticket


def scan(client, ticket, token=None):
    headers = auth(token) if token else {}
    return client.post("/api/scanner/validate",
                       params={"qr_data": ticket["qr_code_data"]}, headers=headers)


def test_scanner_refuse_sans_authentification(env):
    client, db = env
    owner = make_user(db, phone="77400000")
    event = make_event(db, "org")
    ticket = make_ticket(db, event, owner)
    assert scan(client, ticket).status_code in (401, 403)
    assert client.get(f"/api/scanner/check/{ticket['qr_code_data']}").status_code in (401, 403)
    assert run(db.tickets.find_one({"id": ticket["id"]}))["status"] == "valid"


def test_scanner_refuse_a_un_simple_client(env):
    client, db = env
    owner = make_user(db, phone="77400001")
    event = make_event(db, "org")
    ticket = make_ticket(db, event, owner)
    r = scan(client, ticket, token_for(owner))
    assert r.status_code == 403
    assert run(db.tickets.find_one({"id": ticket["id"]}))["status"] == "valid"


def test_organisateur_valide_son_billet_une_seule_fois(env):
    client, db = env
    organizer = make_user(db, role="organizer", email="o@exemple.dj", password=PASSWORD)
    owner = make_user(db, phone="77400002")
    event = make_event(db, organizer["id"])
    ticket = make_ticket(db, event, owner)

    first = scan(client, ticket, token_for(organizer)).json()
    assert first["valid"] is True
    second = scan(client, ticket, token_for(organizer)).json()
    assert second["valid"] is False and second["status"] == "already_used"


def test_organisateur_ne_scanne_pas_le_billet_d_un_autre(env):
    client, db = env
    autre = make_user(db, role="organizer", email="x@exemple.dj", password=PASSWORD)
    owner = make_user(db, phone="77400003")
    event = make_event(db, "un-autre-organisateur")
    ticket = make_ticket(db, event, owner)
    body = scan(client, ticket, token_for(autre)).json()
    assert body["valid"] is False and body["status"] == "wrong_event"
    assert run(db.tickets.find_one({"id": ticket["id"]}))["status"] == "valid"


def test_admin_peut_scanner(env):
    client, db = env
    admin = make_user(db, role="admin", email="a@exemple.dj", password=PASSWORD)
    owner = make_user(db, phone="77400004")
    ticket = make_ticket(db, make_event(db, "org"), owner)
    assert scan(client, ticket, token_for(admin)).json()["valid"] is True


def _staff(db, assigned):
    from services.auth import create_staff_token
    staff = {"id": str(uuid.uuid4()), "full_name": "Agent", "active": True,
             "assigned_events": assigned, "username": "agent" + uuid.uuid4().hex[:4]}
    run(db.staff_accounts.insert_one(staff))
    return staff, create_staff_token({"sub": staff["id"]})


def test_staff_assigne_valide_et_staff_non_assigne_est_refuse(env):
    client, db = env
    owner = make_user(db, phone="77400005")
    event = make_event(db, "org")
    t1 = make_ticket(db, event, owner)
    t2 = make_ticket(db, event, owner)
    _, bon = _staff(db, [event["id"]])
    _, mauvais = _staff(db, ["autre-evenement"])

    assert scan(client, t1, mauvais).json()["status"] == "wrong_event"
    assert run(db.tickets.find_one({"id": t1["id"]}))["status"] == "valid"
    assert scan(client, t2, bon).json()["valid"] is True


def test_staff_desactive_est_refuse(env):
    client, db = env
    owner = make_user(db, phone="77400006")
    event = make_event(db, "org")
    ticket = make_ticket(db, event, owner)
    staff, tok = _staff(db, [event["id"]])
    run(db.staff_accounts.update_one({"id": staff["id"]}, {"$set": {"active": False}}))
    assert scan(client, ticket, tok).status_code == 403


def test_course_entre_deux_scanners_un_seul_gagne(env, monkeypatch):
    """
    Simule la course : le 2e scanner a lu le billet 'valid' AVANT que le 1er
    ne l'ait marque 'used'. Sans le filtre atomique, les deux seraient valides.
    """
    client, db = env
    admin = make_user(db, role="admin", email="a@exemple.dj", password=PASSWORD)
    owner = make_user(db, phone="77400007")
    ticket = make_ticket(db, make_event(db, "org"), owner)
    run(db.tickets.update_one({"id": ticket["id"]}, {"$set": {"status": "used"}}))

    import routes.tickets as routes_tickets
    stale = dict(ticket, status="valid")
    real_find_one = routes_tickets.db.tickets.find_one

    async def stale_find_one(query=None, projection=None):
        if query and query.get("id") == ticket["id"]:
            return dict(stale)
        return await real_find_one(query, projection)

    monkeypatch.setattr(routes_tickets.db.tickets, "find_one", stale_find_one)
    body = scan(client, ticket, token_for(admin)).json()
    assert body["valid"] is False and body["status"] == "already_used"


def test_vue_publique_sans_donnees_personnelles(env):
    client, db = env
    owner = make_user(db, phone="77400008")
    event = make_event(db, "org-secret-id")
    ticket = make_ticket(
        db, event, owner,
        passenger_name="Aïcha", passenger_phone="77123456",
        passenger_id="PASSEPORT-AB123456", payment_method="waafi",
    )
    r = client.get(f"/api/tickets/{ticket['id']}/view")
    assert r.status_code == 200
    body = r.json()
    for interdit in ("user_id", "organizer_id", "passenger_phone", "payment_method"):
        assert interdit not in body
    assert body["passenger_id"].endswith("456") and "PASSEPORT" not in body["passenger_id"]
    assert body["passenger_name"] == "Aïcha"
    assert body["qr_code_data"] == ticket["qr_code_data"]
    assert "77123456" not in r.text and "org-secret-id" not in r.text
