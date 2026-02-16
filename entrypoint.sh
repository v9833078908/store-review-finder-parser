#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  exec python main.py "$@"
fi

if [ "${MODE:-}" = "server" ]; then
  exec uvicorn server:app --host 0.0.0.0 --port "${PORT:-8000}"
fi

GOOGLE_PLAY_URL="${GOOGLE_PLAY_URL:-}"
MAX_REVIEWS="${MAX_REVIEWS:-50}"
LANGS="${LANGS:-en,ru}"
COUNTRY="${COUNTRY:-us}"
MODE="${MODE:-unified}"

if [ -z "$GOOGLE_PLAY_URL" ]; then
  echo "Error: GOOGLE_PLAY_URL is not set. Set env var or pass CLI args." >&2
  exit 1
fi

exec python main.py --mode "$MODE" "$GOOGLE_PLAY_URL" --max-reviews "$MAX_REVIEWS" --langs "$LANGS" --country "$COUNTRY"
