# Runbook

## Fresh local stack

Run `docker compose up --build`. Wait for `/api/health` to return `{"status":"ok"}`. The API startup command applies migrations and seeds `hvac-demo`; the worker polls durable workflow steps. The default loopback host ports are web 13000, API 14000, voice 14100, Postgres 15433, Redis 16380, Temporal 17233/18233, S3 19000/19001, and Mailpit 18025. Set `AIOS_*_PORT` variables in `.env` to change them.

## Demo workflow

Run `npm run demo` from the repo root after Compose is healthy. The script starts an inbound-call workflow using a fixed HVAC caller fixture and waits for terminal state. Inspect the CRM/visit/task/audit pages in the web app and the sent message in Mailpit. `FAIL_DEMO_STEP=send_quote_email` injects a single failure before the actual SMTP side effect; the worker retries the same persisted step and records the failed attempt and retry event.

## Host provisioning

DNS A resolves to `152.53.113.237`, matching the host's public address; no AAAA is published. The operator must confirm A/AAAA records with the DNS provider before changing them. On 2026-10-03, `scripts/install-domain-certificate.sh` installed a Let's Encrypt certificate using `admin@btcpay.exchange`, wrote `/etc/nginx/sites-available/aiemployee.btcpay.exchange`, validated and reloaded Nginx, enabled the Certbot timer, passed a renewal dry-run for this certificate, and verified public HTTP/2 plus `/api/health`. The public root serves `/var/www/aiemployee/index.html`. Nginx proxies only the health route to the local API; all other `/api/` paths return 503 while demo owner-session auth is enabled.

Run the idempotent certificate setup or renewal verification with:

```sh
sudo scripts/install-domain-certificate.sh
```

The full systemd app proxy is separately guarded by `scripts/provision-host.sh`. It requires `/home/sven/.config/ai-employee-os/production.env`, `DEMO_MODE=false`, a unique 32-character `JWT_SECRET`, and active `aios-api`, `aios-worker`, `aios-voice`, and `aios-web` units. It checks DNS before editing Nginx. The app units use loopback ports 33000 (web), 34000 (API), and 34100 (voice) to avoid unrelated host processes on 3000/4000. Production sign-in/MFA is unfinished; do not enable this proxy until that path is ready. Never copy `.env.example` into the production secrets path.

## Current provider limits

The demo uses local test-call ingress and Mailpit because no Twilio, email, Google Calendar, HubSpot, or Stripe credentials were supplied. It never claims a PSTN call or external CRM write. Configure credentials outside Git before enabling real connectors.

Compose names the S3-compatible service `minio` for the endpoint contract, but currently runs RustFS. The original `quay.io/minio/minio:latest` pull returned `401 UNAUTHORIZED`; a pinned public Docker Hub MinIO image pull returned `repository does not exist`. Workaround: use the RustFS container at the same S3 API endpoint (`http://localhost:19000`), or change the service image to an accessible, trusted MinIO registry mirror. Compose publishes development dependencies on high loopback ports by default to coexist with host services; override the `AIOS_*_PORT` values in `.env` if needed.

## Recovery

Workflow runs and step attempts remain in PostgreSQL. Restarting the worker resumes expired leases. For a permanently failed step, inspect `workflow_steps.last_error` and `workflow_events`, correct the provider/configuration issue, then use the task UI/API to retry the blocked step. Do not edit audit rows; the database rejects mutation.
