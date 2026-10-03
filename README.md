# AI Employee OS

An operations platform for HVAC and residential field service companies. Digital employees share controlled company memory and execute auditable service workflows, with people approving consequential actions.

## Launch vertical

**HVAC field service SMBs** (one populated vertical pack at launch). The product vocabulary, qualification flow, service catalog, property/equipment memory, visit scheduling, and sample quote are configured for residential heating and cooling service. Future vertical packs are an extension point, not launch scope.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the monorepo boundaries, database tenancy model, workflow execution, and deployment shape. The first vertical slice is the inbound lead-to-visit-to-quote workflow with a persistent audit trail.

## Local development

Requirements: Docker Engine + Compose and Node.js 24/npm 11. Copy `.env.example` to `.env` to use the local port map or override it. Those credentials are for local development only. Never commit runtime secrets, and never copy this file into the production secrets path.

```sh
docker compose up --build
```

Compose starts PostgreSQL 18 with pgvector, Redis, Temporal, an S3-compatible local object store, Mailpit, API, worker, voice webhook, and the Next.js web app. The API applies migrations and seeds an HVAC demo organization on first start. Open <http://localhost:13000>. Mailpit’s inbox is at <http://localhost:18025>. API health is <http://localhost:14000/api/health>. Compose ports can be changed through `AIOS_*_PORT` variables in `.env`; higher defaults avoid existing host services.

Run the replayable workflow:

```sh
npm run demo
```

The demo submits a fixed inbound-call transcript through the same call-ingress API used by the voice adapter. The worker writes a contact, property, appointment, quote, outbound email, follow-up task, handoff, and chained audit events to PostgreSQL. Email is actually delivered to the local Mailpit SMTP sink. It does not place a PSTN call; real calling requires organization-owned Twilio credentials and a phone number. The demo can inject one tool failure to show retry/resume:

```sh
FAIL_DEMO_STEP=send_quote_email npm run demo
```

The browser recording made by Playwright with the host’s Chrome 154 is [demo/recordings/killer-demo.webm](demo/recordings/killer-demo.webm).

### Local verification captured 2026-10-03

`docker compose up --build -d` completed successfully. Startup output excerpt:

```text
aios-voice:local  Built
aios-worker:local  Built
aios-web:local  Built
aios-api:local  Built
Container ai-employee-os-api-1  Healthy
Container ai-employee-os-voice-1  Started
Container ai-employee-os-web-1  Started
Container ai-employee-os-worker-1  Started
```

Service logs from `docker compose logs --no-color --tail=12 api worker voice web temporal minio`:

```text
api-1     | Seeded HVAC demo organization 11111111-1111-4111-8111-111111111111
worker-1  | {"level":"info","event":"worker_started","workflow":"hvac.inbound_lead_to_visit_quote"}
voice-1   | {"level":30,"time":1790992816654,"pid":30,"hostname":"a2eb9233b853","msg":"Server listening at http://127.0.0.1:4100"}
web-1     | ✓ Ready in 322ms
temporal-1  | Temporal CLI 1.9.1 (Server 1.32.0, UI 2.54.1)
temporal-1  | Temporal Server:      0.0.0.0:7233
temporal-1  | Temporal Persistence: /tmp/temporal.db
minio-1  | Starting: /usr/bin/rustfs  /data
```

Local HTTP checks:

```text
$ curl -sSI http://127.0.0.1:13000
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Sat, 03 Oct 2026 02:00:25 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -sS http://127.0.0.1:14000/api/health
{"status":"ok"}
```

`npm run demo:fresh` built and started the stack, waited for the API, voice ingress, and web app, then completed the seeded replay:

```text
Demo workspace ready at http://localhost:13000
Inbound call accepted: workflow 96203ca7-df6f-4efe-a24e-ba163905ce9d
{
  "runId": "96203ca7-df6f-4efe-a24e-ba163905ce9d",
  "state": "completed",
  "traceId": "e7d61a35-128d-465c-ad41-5243ea0e3eb6",
  "steps": [
    { "step": "qualify_call", "state": "completed", "attempts": 1 },
    { "step": "create_contact_and_property", "state": "completed", "attempts": 1 },
    { "step": "book_visit", "state": "completed", "attempts": 1 },
    { "step": "handoff_to_sales", "state": "completed", "attempts": 1 },
    { "step": "create_quote", "state": "completed", "attempts": 1 },
    { "step": "evaluate_quote_policy", "state": "completed", "attempts": 1 },
    { "step": "send_quote_email", "state": "completed", "attempts": 1 },
    { "step": "schedule_follow_up", "state": "completed", "attempts": 1 },
    { "step": "alert_salesperson", "state": "completed", "attempts": 1 }
  ],
  "retryEvents": 0,
  "eventCount": 9
}
```

The injected failure run also completed: `send_quote_email` finished on attempt 2, with `retryEvents: 1` and `eventCount: 10`. Mailpit recorded actual SMTP deliveries to the demo contact. The E2E check passed with `Google Chrome 154.0.8037.97`; PostgreSQL integration checks passed (7 tests, including cross-tenant read/write isolation and audit tamper detection); the provider-free role eval suite passed 14/14.

## Tests and checks

```sh
npm install
npm run typecheck
npm test
npm run lint
```

CI runs lint, typecheck, unit and PostgreSQL integration tests, role evals, production build, demo replay, and Playwright E2E. This is an early product slice; see [docs/runbook.md](docs/runbook.md) and the “Not done” section for current limits.

## Production domain

The deployment target is <https://aiemployee.btcpay.exchange>. On 2026-10-03, `dig +short A` returned `152.53.113.237`, matching this host, and `dig +short AAAA` returned no record. **The operator must confirm the A/AAAA records with the DNS provider before provisioning or changing DNS.**

Bootstrap is idempotent and refuses to continue if the domain does not resolve to a public address on this host:

```sh
sudo scripts/install-domain-certificate.sh
```

The A record is assumed to point to this host; no AAAA record is currently published. Confirm both records with the DNS provider before future DNS changes. This command uses `admin@btcpay.exchange` for the ACME account, installs the certificate, enables the renewal timer, and verifies HTTPS, API health, and a targeted renewal dry-run. It serves a small setup page publicly and exposes only `/api/health`. All other app API routes return 503 while the local app uses demo authentication. It does not expose the seeded owner session.

The full systemd app proxy is `sudo scripts/provision-host.sh`. It requires `/home/sven/.config/ai-employee-os/production.env`, `DEMO_MODE=false`, a unique 32-character JWT secret, and active `aios-api`, `aios-worker`, `aios-voice`, and `aios-web` units. The production sign-in/MFA path remains incomplete, so this guard currently prevents proxying public traffic to the demo workspace. The unrelated host listeners on ports 3000 and 4000 are avoided by assigning the AIOS systemd services to 33000, 34000, and 34100.

Certificate install and HTTPS checks completed on 2026-10-03. The Let's Encrypt certificate is valid through 2027-01-01 and is installed at `/etc/letsencrypt/live/aiemployee.btcpay.exchange/`. Nginx uses HTTP/2, redirects HTTP to HTTPS, and sets security headers and a 100M upload limit. A second installer run also passed without requesting another certificate.

```text
$ curl -sSI https://aiemployee.btcpay.exchange
HTTP/2 200
server: nginx
date: Sat, 03 Oct 2026 02:25:51 GMT
content-type: text/html
content-length: 251
last-modified: Sat, 03 Oct 2026 02:25:43 GMT
etag: "6ac067a7-fb"
strict-transport-security: max-age=31536000
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
accept-ranges: bytes
```

```text
$ curl -sS https://aiemployee.btcpay.exchange/api/health
{"status":"ok"}
```

Certificate details:

```text
Certificate Name: aiemployee.btcpay.exchange
Key Type: ECDSA
Domains: aiemployee.btcpay.exchange
Expiry Date: 2027-01-01 01:23:09+00:00 (VALID: 89 days)
Certificate Path: /etc/letsencrypt/live/aiemployee.btcpay.exchange/fullchain.pem
Private Key Path: /etc/letsencrypt/live/aiemployee.btcpay.exchange/privkey.pem
subject=CN=aiemployee.btcpay.exchange
issuer=C=US, O=Let's Encrypt, CN=YE1
notBefore=Oct  3 01:23:10 2026 GMT
notAfter=Jan  1 01:23:09 2027 GMT
```

Target certificate renewal dry-run:

```text
$ sudo certbot renew --cert-name aiemployee.btcpay.exchange --dry-run --no-random-sleep-on-renew
Processing /etc/letsencrypt/renewal/aiemployee.btcpay.exchange.conf
Simulating renewal of an existing certificate for aiemployee.btcpay.exchange
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/aiemployee.btcpay.exchange/fullchain.pem (success)
```

Timer status:

```text
$ sudo systemctl status certbot.timer --no-pager
● certbot.timer - Run certbot twice daily
     Loaded: loaded (/usr/lib/systemd/system/certbot.timer; enabled; preset: enabled)
     Active: active (waiting) since Mon 2026-09-07 15:28:59 UTC
     Trigger: Sat 2026-10-03 10:43:54 UTC; 8h left
   Triggers: ● certbot.service
```

The public root currently serves a setup page, and only `/api/health` is proxied. Other `/api/` routes return 503 while the demo uses owner-session authentication. `sudo scripts/provision-host.sh` is the guarded full-app proxy installer; it requires production configuration and active systemd app units, and will refuse to proxy while `DEMO_MODE=true`.

The earlier host-wide renewal dry-run below covers the pre-existing certificate set and was run before this domain certificate existed.

```text
$ sudo -n systemctl status certbot.timer --no-pager
● certbot.timer - Run certbot twice daily
     Loaded: loaded (/usr/lib/systemd/system/certbot.timer; enabled; preset: enabled)
     Active: active (waiting) since Mon 2026-09-07 15:28:59 UTC; 3 weeks 4 days ago
     Trigger: Sat 2026-10-03 11:11:52 UTC; 9h left
   Triggers: ● certbot.service

$ sudo -n certbot renew --dry-run --no-random-sleep-on-renew
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/claw.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/continuityvault.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/cryptomania.buzz/fullchain.pem (success)
  /etc/letsencrypt/live/fixloop.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/freepbx.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/incidentatlas.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/info.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/jarvis.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/lightning.polymarketaipredictions.com/fullchain.pem (success)
  /etc/letsencrypt/live/mail-btcpay-exchange (success)
  /etc/letsencrypt/live/mobile.polymarketaipredictions.com/fullchain.pem (success)
  /etc/letsencrypt/live/payments.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/pbx.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/poker.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/polymarketaipredictions.com/fullchain.pem (success)
  /etc/letsencrypt/live/sidalys.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/storyline.voipclaw.com/fullchain.pem (success)
  /etc/letsencrypt/live/ubeer.btcpay.exchange/fullchain.pem (success)
  /etc/letsencrypt/live/voipclaw.com/fullchain.pem (success)
```

## Plans

Stripe subscription plan targets are $300–$2,000 per location/month, with seat, call-minute, email, and workflow-run allowances and metered overage. Stripe credentials and live price IDs are configured per deployment; test-mode billing remains to be completed.

## Not done

- Production-grade sign-in, TOTP MFA, SSO, complete human RBAC, and access review workflows.
- Real PSTN provisioning, streaming STT/TTS, recording consent by jurisdiction, supervisor whisper/barge controls, and Twilio webhook signature validation.
- LLM provider implementations, structured model tool calls, prompt/model call registry, model budgets, and per-call token/cost tracking; the current lead qualification is deterministic HVAC rules over the supplied transcript.
- Google Calendar/CalDAV sync, HubSpot bidirectional sync, company email setup and deliverability (SPF/DKIM/DMARC), and SMS delivery.
- Full memory retrieval/redaction propagation, encrypted PII columns, SOC 2 operational controls, complete OpenTelemetry dashboards/alerts, and budget/cost enforcement.
- Full AR, support, and purchasing workflow slices; verticals beyond HVAC; external CRM adapters beyond the planned HubSpot adapter.
- Stripe billing portal, metered reconciliation, approval notifications over SMS/email, production E2E browser recordings, and measured coverage threshold.
- Mobile companion apps (no iOS build is planned for this Linux host).
- The domain has certificate-only HTTPS with a setup page and health endpoint. The authenticated app proxy remains blocked until production auth and configuration are complete.
- MinIO is replaced in local Compose by RustFS using its S3-compatible API: the official MinIO repository is archived and the published Quay/Docker Hub image pulls failed from this host (`401 UNAUTHORIZED` from Quay and “repository does not exist” from Docker Hub). MinIO can be restored by supplying an accessible image registry mirror in Compose.

## Host inventory note

The requested `DEVELOPER-TOOLS-INVENTORY.md` was not present under `/home/sven`, `/mnt`, or `/tmp` in this workspace. The host was checked directly: Ubuntu 26.04.1, Node 24.21.0/npm 11.19.0, Python 3.14.7, Rust 1.98.1, PostgreSQL 18.6, Docker 29.1.3/Compose 2.40.3, Nginx 1.28.3, and Certbot 4.0.0 are present. Redis is not installed as a host service and is provided by Compose. No secrets were found in the project because it was initially empty.
