# HVAC lead-to-quote demo

1. On a fresh checkout, run `npm run demo:fresh`. It builds and starts Compose, waits for API health, and replays the seeded call. For later runs, use `npm run demo`.
2. The scripted inbound call enters the receptionist ingress with a fixed transcript: the caller has a failed air conditioner and requests a visit.
3. Watch the employee task, CRM contact, property, visit, quote approval decision, outbound email, follow-up, and salesperson handoff appear in the app. Mailpit shows the actual SMTP delivery.
4. Run `FAIL_DEMO_STEP=send_quote_email npm run demo` to see a failed attempt followed by a resumed retry and audit events.

The replay simulates a telephony webhook request; it does not use a PSTN connection. A Twilio account/number and signed webhook are required for a live external call. The browser recording made with Chrome 154 is `demo/recordings/killer-demo.webm`; Playwright also writes its trace and video under the ignored `demo/recordings/e2e-results/` directory when tests run.
