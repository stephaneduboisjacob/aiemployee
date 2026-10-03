# Architecture

## Product boundary

AI Employee OS is an HVAC service operations product. It owns the operational task from inbound lead through scheduled site visit, quote, follow-up, and a human salesperson alert. Roles are defined product templates with different memory and action scopes; they are not user-authored autonomous agents.

## Monorepo

- `apps/web`: Next.js App Router workspace UI.
- `apps/api`: Fastify REST and WebSocket API; validates requests, authenticates tenant context, and starts workflows.
- `apps/worker`: durable workflow poller and channel activities.
- `apps/voice`: telephony ingress adapter and call event normalization.
- `packages/core`: policy decisions, role templates, and shared domain types.
- `packages/adapters`: provider interfaces and adapters.
- `packages/workflows`: versioned HVAC workflows and step definitions.
- `packages/ui`: shared UI components.
- `packages/evals`: role regression fixtures and evaluation harness.
- `db/migrations`: PostgreSQL schema and row-level security policies.

## Data and tenant isolation

PostgreSQL is the system of record. Tenant-owned tables carry `organization_id`; APIs set `app.organization_id` inside a transaction and PostgreSQL RLS compares the row tenant to that setting. The application DB role is not a superuser or `BYPASSRLS` role. Tenant queries must use the transaction-scoped helper. Cross-tenant behavior is tested against PostgreSQL, not a mocked repository.

Audit events are append-only. A per-organization advisory transaction lock serializes chain heads; a database trigger hashes the prior hash and canonical event fields. Updates/deletes are rejected. Daily chain-root export is a worker responsibility and is still pending.

## Workflow execution

Workflows use a PostgreSQL-backed state machine in the launch slice. Each run and each step is stored separately. Workers claim steps with `FOR UPDATE SKIP LOCKED`, persist leases, attempts, outputs, and events, and use an idempotency key for side effects. A worker restart can resume at the first incomplete step. Retryable failures use bounded backoff; permanent failures move the run to an escalated state. This keeps the first deployment on one durable system of record while the workflow catalog stabilizes. Temporal is included in the development Compose environment for evaluation, but the first slice does not depend on it; replacing the DB worker with Temporal remains an architectural follow-up.

The launch workflow is `hvac.inbound_lead_to_visit_quote.v1`: normalize call → qualify lead → create contact/property → choose a visit slot → book appointment → hand off quote task → draft quote → check quote policy → send email → schedule follow-up → alert salesperson. A quote above the auto-approval ceiling waits for human approval before the send step.

## Channels and providers

Channel adapters normalize phone, SMS, email, calendar, CRM, and web chat events into `interactions`. The current local demo uses an explicit test-call ingress and Mailpit SMTP sink. Provider interfaces are separated so Twilio/Deepgram/TTS, Google/CalDAV, and HubSpot can be configured without changing workflow definitions. No production credentials are embedded in the repo.

## Runtime

Docker Compose runs PostgreSQL 18 + pgvector, Redis, the Temporal dev server, an S3-compatible object store, Mailpit, and the Node services for local development. Compose publishes these on loopback high ports to coexist with other applications on the host. Temporal is for local exploration only in this slice; its SQLite file is ephemeral at `/tmp/temporal.db`, while the active worker state is PostgreSQL-backed. The Compose object store currently uses RustFS because MinIO image pulls failed from this host; its S3 endpoint keeps the application boundary portable. On the host, systemd units are prepared for web/API/worker/voice. A certificate-only Nginx site is installed for the domain; it serves a static setup page and proxies only health checks while demo authentication is enabled. The guarded full-app proxy checks DNS and production configuration before changing traffic routing.

## Known architecture gaps

The first slice does not yet implement full user authentication/MFA, per-human RBAC, production telephony and calendar/CRM provider sync, complete company memory retrieval and redaction propagation, multi-channel approval delivery, full OTel dashboards, or Stripe usage reconciliation. These are listed in README rather than represented as working features.
