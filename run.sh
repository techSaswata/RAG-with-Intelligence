#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_VENV="${ROOT_DIR}/backend/.venv"
BACKEND_REQS="${ROOT_DIR}/backend/requirements.txt"
BACKEND_REQS_STAMP="${BACKEND_VENV}/.requirements.installed"

if [[ ! -d "${BACKEND_VENV}" ]]; then
  echo "Creating backend venv..."
  python3 -m venv "${BACKEND_VENV}"
fi

if [[ ! -x "${BACKEND_VENV}/bin/python" ]]; then
  echo "Backend venv is missing a Python binary."
  exit 1
fi

if [[ ! -f "${BACKEND_REQS_STAMP}" || "${BACKEND_REQS}" -nt "${BACKEND_REQS_STAMP}" ]]; then
  echo "Installing backend dependencies..."
  "${BACKEND_VENV}/bin/pip" install -r "${BACKEND_REQS}"
  touch "${BACKEND_REQS_STAMP}"
fi

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "${ROOT_DIR}/frontend" && npm install)
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
