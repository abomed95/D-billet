# syntax=docker/dockerfile:1
#
# D-Billet - single container for Cloud Run.
#
# On the DigitalOcean Droplet, Nginx serves the React build and proxies /api to
# uvicorn. Cloud Run runs one container, so the FastAPI app serves both (see
# backend/spa.py). Build:
#
#   docker build -t dbillet \
#     --build-arg REACT_APP_BACKEND_URL=https://d-billet.com \
#     --build-arg REACT_APP_SITE_URL=https://d-billet.com .

# ============================================================================
# Stage 1 - React build
# ============================================================================
FROM node:20-bookworm AS frontend

# react-snap pre-renders the public pages with a headless Chromium for SEO.
# Set to false for a faster build (client-side rendering only).
ARG ENABLE_PRERENDER=true
ENV ENABLE_PRERENDER=${ENABLE_PRERENDER}

# Shared libraries required by the Chromium that puppeteer downloads.
RUN if [ "$ENABLE_PRERENDER" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends \
        libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
        libdbus-1-3 libdrm2 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
        libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
        libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
        libxext6 libxfixes3 libxi6 libxkbcommon0 libxrandr2 libxrender1 \
        libxshmfence1 libxss1 libxtst6 fonts-liberation \
      && rm -rf /var/lib/apt/lists/*; \
    else \
      echo "prerender disabled - skipping Chromium runtime libraries"; \
    fi

WORKDIR /app/frontend

# Dependencies first: this layer is cached until package-lock.json changes.
COPY frontend/package.json frontend/package-lock.json ./
# react-snap pulls in puppeteer, which downloads a ~110 MB Chromium on
# install. Skip that download when pre-rendering is off.
RUN if [ "$ENABLE_PRERENDER" != "true" ]; then \
      export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true; \
    fi; \
    npm ci --no-audit --no-fund --legacy-peer-deps

COPY frontend/ ./

# Baked into the bundle at build time: changing them requires a rebuild.
ARG REACT_APP_BACKEND_URL=https://d-billet.com
ARG REACT_APP_SITE_URL=https://d-billet.com
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL} \
    REACT_APP_SITE_URL=${REACT_APP_SITE_URL} \
    GENERATE_SOURCEMAP=false \
    ENABLE_HEALTH_CHECK=false \
    ENABLE_VISUAL_EDITS=false \
    NODE_OPTIONS=--max-old-space-size=2048 \
    CI=false

# craco is invoked directly rather than through `npm run build` so that the
# prebuild/postbuild hooks stay under the control of ENABLE_PRERENDER.
#
# generate-prerender-data.js snapshots /api content into the bundle. It falls
# back to built-in defaults when the API is unreachable, which is what happens
# on a first deploy - rebuild once the service is live to embed real data.
RUN node scripts/generate-prerender-data.js \
 && npx craco build \
 && if [ "$ENABLE_PRERENDER" = "true" ]; then npx react-snap; fi \
 && find build -name '*.map' -delete

# ============================================================================
# Stage 2 - Python dependencies
# ============================================================================
FROM python:3.11-slim-bookworm AS backend-deps

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY backend/requirements-prod.txt ./
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip wheel \
 && /opt/venv/bin/pip install -r requirements-prod.txt

# ============================================================================
# Stage 3 - Runtime
# ============================================================================
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV=production \
    FRONTEND_BUILD_DIR=/app/frontend/build \
    UPLOAD_DIR=/app/backend/uploads \
    PORT=8080 \
    WEB_CONCURRENCY=1

# Unprivileged runtime user.
RUN groupadd --system --gid 1001 dbillet \
 && useradd --system --uid 1001 --gid dbillet --home-dir /app dbillet

COPY --from=backend-deps /opt/venv /opt/venv
COPY --chown=dbillet:dbillet backend/ /app/backend/
COPY --from=frontend --chown=dbillet:dbillet /app/frontend/build /app/frontend/build

# Fallback upload directory. In production this path is replaced by a Cloud
# Storage volume mount - the container filesystem is ephemeral, so anything
# written here disappears when the instance is recycled.
RUN mkdir -p /app/backend/uploads && chown -R dbillet:dbillet /app/backend/uploads

WORKDIR /app/backend
USER dbillet

EXPOSE 8080

# Cloud Run injects $PORT and terminates TLS at the front end, which is why
# forwarded headers are trusted here.
CMD exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers "${WEB_CONCURRENCY}" \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --no-server-header
