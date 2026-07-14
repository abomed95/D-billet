#!/usr/bin/env bash
# Nettoyage avant deploiement.
# A executer une seule fois depuis la racine du repo:
#   bash scripts/cleanup-before-deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Suppression des fichiers temporaires versionnes par accident"
git rm --cached -f --ignore-unmatch \
  .tmp-* \
  frontend-*.log \
  frontend-*.err.log \
  frontend-dev.log \
  backend/.server*.log \
  backend/.server*.err.log \
  backend/.uvicorn-*.log \
  backend/.uvicorn-*.err.log \
  2>/dev/null || true

echo "==> Suppression physique des fichiers temporaires (peut echouer sous mount)"
rm -f .tmp-* 2>/dev/null || true
rm -f frontend-*.log frontend-*.err.log frontend-dev.log 2>/dev/null || true
rm -f backend/.server*.log backend/.server*.err.log 2>/dev/null || true
rm -f backend/.uvicorn-*.log backend/.uvicorn-*.err.log 2>/dev/null || true

echo "==> Verification du contenu du repo"
git status --short

echo ""
echo "==> Etapes suivantes:"
echo "   git add -A"
echo "   git commit -m 'chore(deploy): harden config, rate-limit, nginx headers, sw fix'"
echo "   git push origin main"
