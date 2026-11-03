# Deploiement Google Cloud - D-Billet

Le guide pas a pas est a la racine du depot : **[DEPLOY-GCP.md](../../DEPLOY-GCP.md)**.

## Contenu de ce dossier

| Fichier | Role |
|---------|------|
| `deploy-cloudrun.sh` | Script unique : provisionne l'infra, builde et deploie. Idempotent. |
| `env.production.example` | Reference des variables d'environnement et des secrets attendus. |

Les fichiers lies au build vivent a la racine du depot, la ou Docker et
Cloud Build les attendent :

| Fichier | Role |
|---------|------|
| `Dockerfile` | Image multi-etages : build React puis runtime FastAPI. |
| `cloudbuild.yaml` | Pipeline Cloud Build (utilisable aussi comme trigger GitHub). |
| `.dockerignore` / `.gcloudignore` | Reduisent le contexte envoye au build. |

## Architecture

- **1 service Cloud Run** qui sert le site et l'API sur le meme domaine
- **1 bucket Cloud Storage** monte sur `/mnt/uploads` pour les images
- **Secret Manager** pour `JWT_SECRET`, `MONGO_URL` et les cles WaafiPay
- **MongoDB** : Atlas sur GCP, ou une VM Compute Engine (voir le guide)

Routing, identique au Droplet :

- Site public : `https://d-billet.com`
- API : `https://d-billet.com/api/...`
- Uploads : `https://d-billet.com/uploads/...`

## Demarrage rapide

```bash
gcloud auth login
gcloud config set project <PROJET>
./deploy/gcp/deploy-cloudrun.sh
```
