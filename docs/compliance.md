# Security and compliance controls

This document is a launch control plan, not a claim of certification.

## Controls in the initial slice

- PostgreSQL tenant tables use forced RLS and deny access when transaction tenant context is absent.
- Audit events are append-only and hash chained per organization.
- API rate limits are configured for public endpoints; logs use structured output and avoid call text by default.
- Runtime credentials are environment supplied and excluded from Git.

## Required before production customer data

- Enable email/password authentication, TOTP MFA, session revocation, RBAC checks, and periodic access reviews.
- Validate Twilio signatures; configure consent announcements and state-specific call recording policy before retaining audio/transcripts.
- Add field-level encryption and key rotation for PII, retention enforcement, redaction propagation, and DPA export/delete flows.
- Establish change review, dependency updates, incident response, backup restore tests, and breach notification procedures.
- Set SPF, DKIM, DMARC, bounce handling, and suppression management for every sending domain.
- Add external audit root replication and verify the root against the local append-only file.

## HVAC privacy notes

Property access instructions and equipment identifiers may be sensitive. Collect only details needed to schedule and complete service. Do not retain card data, door codes, or unrelated household details in transcripts. State call-recording consent laws vary; obtain legal review for each service area and announce recording as required before enabling retention.

---

Contact: Stephane Jacob <jacobstephane@outlook.com>
