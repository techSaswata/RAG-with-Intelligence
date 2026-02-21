#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_VENV="${ROOT_DIR}/backend/.venv"

if [[ ! -x "${BACKEND_VENV}/bin/uvicorn" ]]; then
  echo "Backend venv not found. Create it first:"
  echo "  python3 -m venv backend/.venv"
  echo "  backend/.venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "Frontend dependencies not installed. Run:"
  echo "  cd frontend && npm install"
  exit 1
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

(
  cd "${ROOT_DIR}/backend"
  exec "${BACKEND_VENV}/bin/uvicorn" main:app --reload --port 8000
) &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/frontend"
  exec npm run dev
) &
FRONTEND_PID=$!

wait
