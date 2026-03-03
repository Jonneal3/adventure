#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

node scripts/vercel-env-manager.js push \
  --source env/.env.shared.production \
  --target production \
  --prune \
  "$@"
