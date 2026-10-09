# Deployment runbook

This guide describes a generic self-hosted deployment. Replace the example paths and domain with values for your own environment before use. The checked-in service and Nginx files are templates, not a record of a production host.

## Local development

Copy `.env.example` to `.env`, then start the development stack from the repository root:

```sh
npm ci
docker compose up --build
```

Use fictional seed data and the local Mailpit sink. Keep provider credentials out of the repository and do not point the development stack at a production database.

## Self-hosted deployment outline

1. Create a dedicated service account and a deployment directory such as `/opt/ai-employee-os`.
2. Install the supported Node.js and npm versions, Docker Compose, and any required host packages.
3. Store production configuration in a root-managed environment file such as `/etc/ai-employee-os/production.env`, with restrictive permissions. Do not reuse `.env.example` values as production secrets.
4. Configure PostgreSQL, Redis, Temporal, object storage, SMTP, and the application services for the target environment. Bind internal services to private interfaces.
5. Build and deploy the API, worker, voice webhook, and web service. Review the example systemd units and Nginx configuration before installing them.
6. Set the public origin and TLS certificates for a domain you control. Do not publish certificate private keys or live environment files.
7. Verify service health, backups, audit retention, provider sandbox behavior, and a rollback path before enabling real customer workflows.

The scripts in `scripts/` are operator helpers and require explicit environment configuration. Review them before running them with elevated privileges. A public source checkout must not be treated as a ready-to-run production deployment.

## Backups and incident response

Back up PostgreSQL, object storage, and deployment configuration through an encrypted process with access controls. Exclude `.env`, private keys, customer recordings, and production exports from public Git. Test restoration in an isolated environment.

## Contact

Stephane Jacob <jacobstephane@outlook.com>
