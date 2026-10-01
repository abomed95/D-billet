#!/usr/bin/env bash
#
# D-Billet - build and deploy to Cloud Run.
#
# Idempotent: safe to re-run. The first run provisions everything (APIs,
# Artifact Registry, uploads bucket, service account, secrets); later runs
# just rebuild the image and roll out a new revision.
#
# Usage:
#   ./deploy/gcp/deploy-cloudrun.sh
#   PROJECT_ID=my-project REGION=europe-west1 ./deploy/gcp/deploy-cloudrun.sh
#
# Prerequisites: gcloud CLI authenticated (`gcloud auth login`) and a billing
# account attached to the project.

set -euo pipefail

# ============================== Settings ==============================

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-dbillet}"
REPO="${REPO:-dbillet}"
BUCKET="${BUCKET:-${PROJECT_ID}-dbillet-uploads}"
RUNTIME_SA="${RUNTIME_SA:-dbillet-run}"

DOMAIN="${DOMAIN:-d-billet.com}"
APP_URL="${APP_URL:-https://${DOMAIN}}"
CORS_ORIGINS="${CORS_ORIGINS:-https://${DOMAIN},https://www.${DOMAIN}}"
DB_NAME="${DB_NAME:-dbillet}"

# Scaling. MIN_INSTANCES=0 scales to zero (cheapest, but the first request
# after an idle period pays a cold start). Set 1 to keep the site warm.
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
MEMORY="${MEMORY:-512Mi}"
CPU="${CPU:-1}"
CONCURRENCY="${CONCURRENCY:-80}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-300}"

# Pre-rendering the public pages needs a headless Chromium at build time.
ENABLE_PRERENDER="${ENABLE_PRERENDER:-true}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}"
TAG="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ -n "$PROJECT_ID" ]] || die "PROJECT_ID is not set and no gcloud default project is configured."
command -v gcloud >/dev/null || die "gcloud CLI not found: https://cloud.google.com/sdk/docs/install"

gcloud config set project "$PROJECT_ID" >/dev/null

cat <<SUMMARY

  Project      : ${PROJECT_ID}
  Region       : ${REGION}
  Service      : ${SERVICE}
  Image        : ${IMAGE}:${TAG}
  Uploads      : gs://${BUCKET} -> /mnt/uploads
  Public URL   : ${APP_URL}
  Scaling      : ${MIN_INSTANCES}-${MAX_INSTANCES} instances, ${CPU} vCPU / ${MEMORY}

SUMMARY

read -rp "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || die "Aborted."

# ============================== APIs ==============================

log "Enabling the required APIs (no-op if already enabled)"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com

# ========================= Artifact Registry =========================

if ! gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1; then
    log "Creating the Artifact Registry repository '${REPO}'"
    gcloud artifacts repositories create "$REPO" \
        --repository-format=docker \
        --location="$REGION" \
        --description="D-Billet container images"
else
    log "Artifact Registry repository '${REPO}' already exists"
fi

# ========================== Uploads bucket ==========================

if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
    log "Creating the uploads bucket gs://${BUCKET}"
    gcloud storage buckets create "gs://${BUCKET}" \
        --location="$REGION" \
        --uniform-bucket-level-access \
        --public-access-prevention
else
    log "Bucket gs://${BUCKET} already exists"
fi

# ========================= Service account =========================

SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    log "Creating the runtime service account ${SA_EMAIL}"
    gcloud iam service-accounts create "$RUNTIME_SA" \
        --display-name="D-Billet Cloud Run runtime"
else
    log "Service account ${SA_EMAIL} already exists"
fi

log "Granting read/write on the uploads bucket"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.objectAdmin" >/dev/null

# ============================= Secrets =============================

# create_secret <name> <prompt> <generate|prompt|optional>
create_secret() {
    local name="$1" prompt="$2" mode="$3" value=""

    if gcloud secrets describe "$name" >/dev/null 2>&1; then
        echo "    secret ${name}: already exists, keeping the current version"
    else
        case "$mode" in
            generate)
                value="$(openssl rand -hex 64)"
                echo "    secret ${name}: generated"
                ;;
            generate_ed25519)
                # 32 random bytes, base64url without padding: the seed the
                # ticket QR signature is built from.
                value="$(openssl rand 32 | basenc --base64url 2>/dev/null | tr -d '=' \
                    || openssl rand 32 | base64 | tr '+/' '-_' | tr -d '=\n')"
                echo "    secret ${name}: generated"
                ;;
            prompt)
                read -rsp "    ${prompt}: " value; echo
                [[ -n "$value" ]] || die "${name} cannot be empty."
                ;;
            optional)
                read -rsp "    ${prompt} (leave empty to skip): " value; echo
                if [[ -z "$value" ]]; then
                    echo "    secret ${name}: skipped"
                    return 1
                fi
                ;;
        esac
        gcloud secrets create "$name" --replication-policy=automatic >/dev/null
        printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    fi

    gcloud secrets add-iam-policy-binding "$name" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/secretmanager.secretAccessor" >/dev/null
    return 0
}

log "Configuring Secret Manager"
create_secret "dbillet-jwt-secret" "JWT signing key" generate
create_secret "dbillet-mongo-url"  "MongoDB connection string (mongodb+srv://...)" prompt
# Without this, ticket QR codes stay unsigned and cannot be checked offline on
# the train or the ferry. Rotating it invalidates every ticket already issued.
create_secret "dbillet-ticket-signing-key" "Ticket QR signing key" generate_ed25519

SECRET_REFS="JWT_SECRET=dbillet-jwt-secret:latest"
SECRET_REFS="${SECRET_REFS},MONGO_URL=dbillet-mongo-url:latest"
SECRET_REFS="${SECRET_REFS},TICKET_SIGNING_KEY=dbillet-ticket-signing-key:latest"
add_optional_secret() {
    if create_secret "$1" "$2" optional; then
        SECRET_REFS="${SECRET_REFS},$3=$1:latest"
    fi
}
add_optional_secret "dbillet-google-client-secret" "Google OAuth client secret" GOOGLE_CLIENT_SECRET
add_optional_secret "dbillet-waafipay-merchant"    "WaafiPay merchant UID"      WAAFIPAY_MERCHANT_UID
add_optional_secret "dbillet-waafipay-api-user"    "WaafiPay API user id"       WAAFIPAY_API_USER_ID
add_optional_secret "dbillet-waafipay-api-key"     "WaafiPay API key"           WAAFIPAY_API_KEY
add_optional_secret "dbillet-waafipay-store"       "WaafiPay store id"          WAAFIPAY_STORE_ID
add_optional_secret "dbillet-waafipay-hpp-key"     "WaafiPay HPP key"           WAAFIPAY_HPP_KEY

# ============================== Build ==============================

log "Building the image with Cloud Build (5-10 minutes on the first run)"
gcloud builds submit "$REPO_ROOT" \
    --config "${REPO_ROOT}/cloudbuild.yaml" \
    --substitutions "_IMAGE=${IMAGE},_TAG=${TAG},_SITE_URL=${APP_URL},_ENABLE_PRERENDER=${ENABLE_PRERENDER}"

# ============================== Deploy ==============================

ENV_VARS="APP_ENV=production"
ENV_VARS="${ENV_VARS},APP_URL=${APP_URL}"
ENV_VARS="${ENV_VARS},FRONTEND_URL=${APP_URL}"
ENV_VARS="${ENV_VARS},BACKEND_CORS_ORIGINS=${CORS_ORIGINS}"
ENV_VARS="${ENV_VARS},DB_NAME=${DB_NAME}"
ENV_VARS="${ENV_VARS},MONGO_SERVER_SELECTION_TIMEOUT_MS=5000"
ENV_VARS="${ENV_VARS},UPLOAD_DIR=/mnt/uploads"
ENV_VARS="${ENV_VARS},WEB_CONCURRENCY=1"

log "Deploying to Cloud Run"
gcloud run deploy "$SERVICE" \
    --image "${IMAGE}:${TAG}" \
    --region "$REGION" \
    --platform managed \
    --service-account "$SA_EMAIL" \
    --allow-unauthenticated \
    --port 8080 \
    --cpu "$CPU" \
    --memory "$MEMORY" \
    --min-instances "$MIN_INSTANCES" \
    --max-instances "$MAX_INSTANCES" \
    --concurrency "$CONCURRENCY" \
    --timeout "$REQUEST_TIMEOUT" \
    --add-volume "name=uploads,type=cloud-storage,bucket=${BUCKET}" \
    --add-volume-mount "volume=uploads,mount-path=/mnt/uploads" \
    --set-env-vars "$ENV_VARS" \
    --set-secrets "$SECRET_REFS"

SERVICE_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"

# ===================== Admin bootstrap job =====================

log "Configuring the 'create the first admin' job"
JOB_ARGS=(
    --image "${IMAGE}:${TAG}"
    --region "$REGION"
    --service-account "$SA_EMAIL"
    --command python
    --args create_admin.py
    --set-env-vars "APP_ENV=production,DB_NAME=${DB_NAME}"
    --set-secrets "JWT_SECRET=dbillet-jwt-secret:latest,MONGO_URL=dbillet-mongo-url:latest"
    --max-retries 0
)
if gcloud run jobs describe "${SERVICE}-create-admin" --region "$REGION" >/dev/null 2>&1; then
    gcloud run jobs update "${SERVICE}-create-admin" "${JOB_ARGS[@]}" >/dev/null
else
    gcloud run jobs create "${SERVICE}-create-admin" "${JOB_ARGS[@]}" >/dev/null
fi

# ============================== Done ==============================

cat <<DONE

  Deployed: ${SERVICE_URL}

  Check it:
    curl -fsS ${SERVICE_URL}/health
    curl -I   ${SERVICE_URL}

  Create the first administrator (no account exists in production):
    gcloud run jobs execute ${SERVICE}-create-admin --region ${REGION} --wait \\
      --update-env-vars ADMIN_EMAIL=admin@${DOMAIN},ADMIN_PASSWORD='<strong password>'

  Map the custom domain: see DEPLOY-GCP.md, phase 5.

DONE

if [[ "$APP_URL" != "$SERVICE_URL" ]]; then
    warn "APP_URL is ${APP_URL} but Cloud Run serves ${SERVICE_URL}."
    warn "Until ${DOMAIN} points at the service, browse it through ${SERVICE_URL}"
    warn "and rebuild after mapping the domain (REACT_APP_BACKEND_URL is baked in at build time)."
fi
