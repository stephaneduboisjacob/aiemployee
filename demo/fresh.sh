#!/usr/bin/env bash
set -Eeuo pipefail

docker compose up --build -d
ready=0
for attempt in $(seq 1 120); do
  if curl --fail --silent http://127.0.0.1:14000/api/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:14100/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:13000/ >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  docker compose logs --no-color --tail=100 api worker voice web
  echo "API, voice ingress, and web app did not become healthy within four minutes." >&2
  exit 1
fi

echo "Demo workspace ready at http://localhost:13000"
bash demo/run.sh
