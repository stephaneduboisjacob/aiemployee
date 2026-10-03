#!/usr/bin/env bash
set -Eeuo pipefail
REPO="/home/sven/aiemployee"
CONFIG="/home/sven/.config/ai-employee-os/production.env"
SERVICES=(api worker voice web)

if [[ "$(id -u)" -ne 0 ]]; then exec sudo "$0" "$@"; fi
if [[ ! -f "$CONFIG" ]]; then echo "Missing production runtime configuration: create ${CONFIG} out of band. Do not copy .env.example; it contains local demo settings." >&2; exit 1; fi
if [[ ! -d "$REPO/.git" ]]; then echo "Expected Git checkout at ${REPO}." >&2; exit 1; fi

install -d -o sven -g sven -m 0750 /var/log/ai-employee-os /home/sven/.config/ai-employee-os
chown sven:sven "$CONFIG"
chmod 0600 "$CONFIG"
runuser -u sven -- bash -lc "cd '${REPO}' && npm ci && npm run build"
runuser -u sven -- bash -lc "cd '${REPO}' && set -a && source '${CONFIG}' && set +a && npm run db:migrate"

for name in "${SERVICES[@]}"; do
  install -m 0644 "${REPO}/deploy/aios-${name}.service" "/etc/systemd/system/aios-${name}.service"
done
systemctl daemon-reload
for name in "${SERVICES[@]}"; do
  systemctl enable --now "aios-${name}.service"
  systemctl restart "aios-${name}.service"
done
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:34000/api/health >/dev/null; then break; fi
  if [[ "$attempt" -eq 30 ]]; then systemctl status aios-api.service --no-pager; exit 1; fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:34000/api/health
echo "Deploy complete. Run scripts/provision-host.sh after DNS is confirmed."
