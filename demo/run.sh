#!/usr/bin/env bash
set -Eeuo pipefail
API_URL="${AIOS_API_URL:-http://localhost:14000}"
VOICE_URL="${AIOS_VOICE_URL:-http://localhost:14100}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

curl --fail --silent --show-error "${API_URL}/api/health" > /dev/null
curl --fail --silent --show-error "${API_URL}/api/v1/demo/session" > "${tmpdir}/session.json"
token="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).token)" < "${tmpdir}/session.json")"

node -e 'const d={caller:{name:"Jamie Rivera",phone:"+15125550182",email:"jamie.rivera@example.test",address:"4408 Cedar Bend Dr",city:"Austin",region:"TX",postalCode:"78745",issue:"The AC is running but blowing warm air",preferredWindow:"weekday morning"},transcript:"Hi, this is Jamie Rivera. Our air conditioner is running but blowing warm air. I am at 4408 Cedar Bend Drive in Austin. Can someone come tomorrow morning? My email is jamie.rivera@example.test.",failOnceStep:process.env.FAIL_DEMO_STEP||undefined}; process.stdout.write(JSON.stringify(d))' > "$tmpdir/call.json"
curl --fail --silent --show-error -X POST "${VOICE_URL}/voice/simulate" -H 'Content-Type: application/json' --data-binary @"$tmpdir/call.json" > "$tmpdir/started.json"
workflow_id="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).id)" < "$tmpdir/started.json")"
printf 'Inbound call accepted: workflow %s\n' "$workflow_id"

for attempt in $(seq 1 120); do
  curl --fail --silent --show-error "${API_URL}/api/v1/workflows/${workflow_id}" -H "Authorization: Bearer ${token}" > "$tmpdir/workflow.json"
  state="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).run.state)" < "$tmpdir/workflow.json")"
  if [[ "$state" == completed || "$state" == failed || "$state" == waiting_approval ]]; then break; fi
  sleep 1
done

node --input-type=module - "$tmpdir/workflow.json" <<'NODE'
import fs from 'node:fs';
const workflow = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const result = {
  runId: workflow.run.id,
  state: workflow.run.state,
  traceId: workflow.run.trace_id,
  steps: workflow.steps.map(({ step_key, state, attempts, last_error }) => ({ step: step_key, state, attempts, ...(last_error ? { lastError: last_error } : {}) })),
  retryEvents: workflow.events.filter((event) => event.event_type === 'step_failed_retry_scheduled').length,
  eventCount: workflow.events.length,
};
console.log(JSON.stringify(result, null, 2));
if (result.state !== 'completed') process.exitCode = 1;
NODE
