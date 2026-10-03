import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { employeeTemplates } from '@aios/core/employees';
import { pool, withTenant } from './db.js';
import { redis, workflowQueue } from './queue.js';

const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] }, bodyLimit: 1_048_576, genReqId: () => crypto.randomUUID() });
const jwtSecret = process.env.JWT_SECRET ?? 'local-demo-secret-change-before-production-32-bytes';
const demoOrgId = process.env.DEMO_ORG_ID ?? '11111111-1111-4111-8111-111111111111';
const demoUserId = '22222222-2222-4222-8222-222222222222';

await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true, credentials: true });
await app.register(jwt, { secret: jwtSecret });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(websocket);

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try { await request.jwtVerify(); }
  catch { return reply.code(401).send({ error: 'authentication_required' }); }
}

function tenant(request: FastifyRequest): string {
  const claims = request.user as { orgId?: string };
  if (!claims.orgId) throw new Error('Tenant claim missing');
  return claims.orgId;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

app.get('/api/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok' };
});

app.get('/healthz', async () => ({ status: 'ok' }));

app.get('/api/v1/demo/session', async (_request, reply) => {
  if (process.env.DEMO_MODE !== 'true') return reply.code(404).send({ error: 'not_found' });
  const token = app.jwt.sign({ sub: demoUserId, orgId: demoOrgId, role: 'owner' }, { expiresIn: '1h' });
  return { token, organizationId: demoOrgId, userId: demoUserId };
});

app.get('/api/v1/dashboard', { preHandler: authenticate }, async (request) => {
  const organizationId = tenant(request);
  return withTenant(organizationId, async (db) => {
    const [employees, tasks, appointments, quotes, interactions, audit, contacts, approvals, totals, integrity] = await Promise.all([
      db.query("SELECT id, name, role, state, avatar, capabilities, memory_scope, working_hours, escalation_contact, approval_defaults FROM digital_employees ORDER BY role"),
      db.query("SELECT id, title, state, priority, created_at FROM tasks ORDER BY created_at DESC LIMIT 12"),
      db.query("SELECT a.id, a.service_code, a.starts_at, a.ends_at, c.first_name, c.last_name, p.address_line1, p.city FROM appointments a JOIN contacts c ON c.id=a.contact_id LEFT JOIN properties p ON p.id=a.property_id ORDER BY a.starts_at DESC LIMIT 8"),
      db.query("SELECT id, quote_number, amount_cents, state, created_at FROM quotes ORDER BY created_at DESC LIMIT 8"),
      db.query("SELECT id, channel, direction, outcome, created_at, trace_id FROM interactions ORDER BY created_at DESC LIMIT 8"),
      db.query("SELECT id, action, target, actor_type, trace_id, occurred_at, entry_hash FROM audit_events ORDER BY occurred_at DESC LIMIT 10"),
      db.query("SELECT id,first_name,last_name,email,phone,customer_tier,created_at FROM contacts ORDER BY created_at DESC LIMIT 50"),
      db.query("SELECT d.id,d.action_type,d.target_id,d.decision,d.inputs,d.policy_version,d.expires_at,d.created_at,p.name AS policy_name,p.approvers,q.quote_number,q.amount_cents,c.first_name,c.last_name FROM approval_decisions d JOIN approval_policies p ON p.id=d.policy_id LEFT JOIN quotes q ON q.id=d.target_id LEFT JOIN contacts c ON c.id=q.contact_id WHERE d.decision='pending' ORDER BY d.created_at"),
      db.query("SELECT (SELECT count(*) FROM interactions WHERE channel='phone' AND direction='inbound')::int AS inbound_calls,(SELECT count(*) FROM contacts)::int AS contacts,(SELECT count(*) FROM quotes)::int AS quote_count,(SELECT coalesce(sum(amount_cents),0)::bigint FROM quotes WHERE state IN ('approved','sent')) AS quote_value_cents"),
      db.query('SELECT aios_verify_audit_chain($1) AS valid', [organizationId]),
    ]);
    return { employees: employees.rows, tasks: tasks.rows, appointments: appointments.rows, quotes: quotes.rows, interactions: interactions.rows, audit: audit.rows, contacts: contacts.rows, approvals: approvals.rows, totals: totals.rows[0], auditIntegrity: integrity.rows[0].valid };
  });
});

app.post('/api/v1/employees', { preHandler: authenticate }, async (request, reply) => {
  const claims = request.user as { sub?: string; role?: string };
  if (!['owner','admin'].includes(claims.role ?? '')) return reply.code(403).send({ error: 'administrator_role_required' });
  const schema = z.object({ role: z.enum(['receptionist','sales_assistant','ar_clerk','support_technician','purchasing_assistant']), name: z.string().trim().min(1).max(80).optional() });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_employee', issues: parsed.error.issues });
  const template = employeeTemplates.find((item) => item.role === parsed.data.role)!;
  const organizationId = tenant(request);
  const employee = await withTenant(organizationId, async (db) => {
    const inserted = await db.query("INSERT INTO digital_employees (organization_id,name,role,owner_user_id,system_prompt,prompt_version,capabilities,memory_scope,approval_defaults,state) VALUES ($1,$2,$3,$4,$5,'1.0.0',$6,$7,$8,'active') ON CONFLICT (organization_id,role) DO UPDATE SET name=EXCLUDED.name,state='active' RETURNING id,name,role,state", [organizationId, parsed.data.name ?? template.title, parsed.data.role, claims.sub, template.systemPrompt, JSON.stringify(template.capabilities), JSON.stringify(template.memoryScope), JSON.stringify(template.approvalDefaults)]);
    await db.query("INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'human',$2,'employee_hired',$3,$4,$5,$6,$7)", [organizationId, claims.sub, `employee:${inserted.rows[0].id}`, hash(parsed.data), hash(inserted.rows[0]), crypto.randomUUID(), JSON.stringify({ role: parsed.data.role })]);
    return inserted.rows[0];
  });
  return reply.code(201).send({ employee });
});

app.patch('/api/v1/employees/:id/state', { preHandler: authenticate }, async (request, reply) => {
  const claims = request.user as { sub?: string; role?: string };
  if (!['owner','admin'].includes(claims.role ?? '')) return reply.code(403).send({ error: 'administrator_role_required' });
  const parsed = z.object({ state: z.enum(['active','paused','fired']) }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_employee_state' });
  const organizationId = tenant(request);
  const { id } = request.params as { id: string };
  const employee = await withTenant(organizationId, async (db) => {
    const updated = await db.query('UPDATE digital_employees SET state=$2 WHERE id=$1 RETURNING id,name,role,state', [id, parsed.data.state]);
    if (!updated.rowCount) return null;
    await db.query("INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'human',$2,'employee_state_changed',$3,$4,$5,$6,$7)", [organizationId, claims.sub, `employee:${id}`, hash({ state: parsed.data.state }), hash(updated.rows[0]), crypto.randomUUID(), JSON.stringify({ role: updated.rows[0].role })]);
    return updated.rows[0];
  });
  if (!employee) return reply.code(404).send({ error: 'employee_not_found' });
  return { employee };
});

const inboundCallSchema = z.object({
  caller: z.object({ name: z.string().min(1), phone: z.string().min(5), email: z.string().email(), address: z.string().min(5), city: z.string().min(2), region: z.string().min(2), postalCode: z.string().min(3), issue: z.string().min(4), preferredWindow: z.string().optional() }),
  transcript: z.string().min(12), failOnceStep: z.string().optional(),
});

app.post('/api/v1/calls/inbound', { preHandler: authenticate }, async (request, reply) => {
  const parsed = inboundCallSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_call', issues: parsed.error.issues });
  const organizationId = tenant(request);
  const traceId = crypto.randomUUID();
  const { caller, transcript, failOnceStep } = parsed.data;
  const run = await withTenant(organizationId, async (db) => {
    const org = await db.query("SELECT coalesce((settings->>'transcriptRetention')::boolean,false) AS transcript_retention FROM organizations WHERE organization_id=$1", [organizationId]);
    const retainTranscript = org.rows[0]?.transcript_retention === true;
    const employee = await db.query("SELECT id FROM digital_employees WHERE role='receptionist' AND state='active' LIMIT 1");
    if (!employee.rowCount) throw new Error('No active receptionist is hired');
    const interaction = await db.query(
      "INSERT INTO interactions (organization_id, channel, direction, caller, participants, transcript, transcript_retained, outcome, trace_id) VALUES ($1,'phone','inbound',$2,$3,$4,$5,'lead_qualified',$6) RETURNING id",
      [organizationId, caller.phone, JSON.stringify([{ name: caller.name, phone: caller.phone, email: caller.email }]), JSON.stringify(retainTranscript ? [{ speaker: 'caller', text: transcript }] : []), retainTranscript, traceId],
    );
    const created = await db.query(
      "INSERT INTO workflow_runs (organization_id, workflow_type, workflow_version, input, interaction_id, trace_id) VALUES ($1,'hvac.inbound_lead_to_visit_quote','1.0.0',$2,$3,$4) RETURNING id",
      [organizationId, JSON.stringify({ caller, ...(retainTranscript ? { transcript } : {}), receptionistId: employee.rows[0].id, failOnceStep }), interaction.rows[0].id, traceId],
    );
    const steps = ['qualify_call','create_contact_and_property','book_visit','handoff_to_sales','create_quote','evaluate_quote_policy','send_quote_email','schedule_follow_up','alert_salesperson'];
    for (const [index, stepKey] of steps.entries()) {
      await db.query(
        "INSERT INTO workflow_steps (organization_id, workflow_run_id, step_key, step_order, idempotency_key, input) VALUES ($1,$2,$3,$4,$5,$6)",
        [organizationId, created.rows[0].id, stepKey, index + 1, `${created.rows[0].id}:${stepKey}`, JSON.stringify({})],
      );
    }
    await db.query(
      "INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'employee',$2,'inbound_call_received',$3,$4,$5,$6,$7)",
      [organizationId, employee.rows[0].id, `interaction:${interaction.rows[0].id}`, hash({ caller, transcript }), hash({ workflowId: created.rows[0].id }), traceId, JSON.stringify({ channel: 'phone', workflowType: 'hvac.inbound_lead_to_visit_quote', transcriptRetained: retainTranscript })],
    );
    await db.query("UPDATE workflow_runs SET state='queued', updated_at=now() WHERE id=$1", [created.rows[0].id]);
    return { id: created.rows[0].id, interactionId: interaction.rows[0].id, traceId };
  });
  await workflowQueue.add('run', { organizationId, workflowRunId: run.id }, { jobId: `run-${run.id}` });
  return reply.code(202).send({ ...run, state: 'queued' });
});

app.get('/api/v1/workflows/:id', { preHandler: authenticate }, async (request, reply) => {
  const organizationId = tenant(request);
  const { id } = request.params as { id: string };
  return withTenant(organizationId, async (db) => {
    const run = await db.query('SELECT id, workflow_type, workflow_version, state, input, output, last_error, trace_id, created_at, updated_at FROM workflow_runs WHERE id=$1', [id]);
    if (!run.rowCount) return reply.code(404).send({ error: 'not_found' });
    const steps = await db.query('SELECT step_key, state, attempts, output, last_error, started_at, completed_at FROM workflow_steps WHERE workflow_run_id=$1 ORDER BY step_order', [id]);
    const events = await db.query('SELECT event_type, step_key, payload, created_at FROM workflow_events WHERE workflow_run_id=$1 ORDER BY created_at', [id]);
    return { run: run.rows[0], steps: steps.rows, events: events.rows };
  });
});

app.get('/api/v1/audit', { preHandler: authenticate }, async (request) => {
  const organizationId = tenant(request);
  const { taskId, contactId, limit = '100' } = request.query as { taskId?: string; contactId?: string; limit?: string };
  const count = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  return withTenant(organizationId, async (db) => {
    const result = await db.query('SELECT id, actor_type, actor_id, action, target, trace_id, details, previous_hash, entry_hash, occurred_at FROM audit_events WHERE ($1::text IS NULL OR target ILIKE $1) ORDER BY occurred_at DESC LIMIT $2', [taskId ? `%${taskId}%` : contactId ? `%${contactId}%` : null, count]);
    return { entries: result.rows };
  });
});

app.get('/api/v1/approvals', { preHandler: authenticate }, async (request) => {
  const organizationId = tenant(request);
  return withTenant(organizationId, async (db) => {
    const approvals = await db.query("SELECT d.id,d.action_type,d.target_id,d.decision,d.inputs,d.policy_version,d.expires_at,d.created_at,p.name AS policy_name,p.approvers,q.quote_number,q.amount_cents,c.first_name,c.last_name FROM approval_decisions d JOIN approval_policies p ON p.id=d.policy_id LEFT JOIN quotes q ON q.id=d.target_id LEFT JOIN contacts c ON c.id=q.contact_id WHERE d.decision='pending' ORDER BY d.created_at");
    return { approvals: approvals.rows };
  });
});

app.post('/api/v1/memory/search', { preHandler: authenticate }, async (request, reply) => {
  const schema = z.object({ query: z.string().trim().min(2).max(300), employeeRole: z.enum(['receptionist','sales_assistant','ar_clerk','support_technician','purchasing_assistant']), embedding: z.array(z.number().finite()).length(1536).optional(), limit: z.number().int().min(1).max(50).default(10) });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_memory_search', issues: parsed.error.issues });
  const organizationId = tenant(request);
  const claims = request.user as { sub?: string };
  const scoped = {
    receptionist: ['receptionist','shared'],
    sales_assistant: ['sales_assistant','shared'],
    ar_clerk: ['ar_clerk','shared'],
    support_technician: ['support_technician','shared'],
    purchasing_assistant: ['purchasing_assistant','shared'],
  } as const;
  const allowed = scoped[parsed.data.employeeRole];
  return withTenant(organizationId, async (db) => {
    const vector = parsed.data.embedding ? `[${parsed.data.embedding.join(',')}]` : null;
    const result = await db.query(
      `WITH candidates AS (
        SELECT id,kind,entity_id,scope,content,search_text,provenance_employee_id,provenance_task_id,source,confidence,
          ts_rank_cd(to_tsvector('english',search_text),plainto_tsquery('english',$1)) AS keyword_score,
          CASE WHEN $2::vector IS NULL OR embedding IS NULL THEN 0::real ELSE (1-(embedding <=> $2::vector))::real END AS vector_score
        FROM memory_items
        WHERE redacted_at IS NULL AND scope=ANY($3::text[])
          AND (to_tsvector('english',search_text) @@ plainto_tsquery('english',$1) OR ($2::vector IS NOT NULL AND embedding IS NOT NULL))
      )
      SELECT *, keyword_score*0.65+vector_score*0.35 AS combined_score,
        CASE WHEN keyword_score>0 AND vector_score>0 THEN 'keyword and vector match' WHEN keyword_score>0 THEN 'keyword match' ELSE 'vector match' END AS match_reason
      FROM candidates ORDER BY combined_score DESC, keyword_score DESC LIMIT $4`,
      [parsed.data.query, vector, allowed, parsed.data.limit],
    );
    const returned = result.rows.map(({ id, kind, scope, keyword_score, vector_score, combined_score, match_reason }) => ({ id, kind, scope, keywordScore: Number(keyword_score), vectorScore: Number(vector_score), combinedScore: Number(combined_score), reason: match_reason }));
    const traceId = crypto.randomUUID();
    await db.query("INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'human',$2,'memory_retrieved','memory-search',$3,$4,$5,$6)", [organizationId, claims.sub, hash({ query: parsed.data.query }), hash(returned), traceId, JSON.stringify({ employeeRole: parsed.data.employeeRole, returned })]);
    return { items: result.rows.map(({ id, kind, entity_id, content, provenance_employee_id, provenance_task_id, source, confidence, combined_score, match_reason }) => ({ id, kind, entityId: entity_id, content, provenanceEmployeeId: provenance_employee_id, provenanceTaskId: provenance_task_id, source, confidence, score: Number(combined_score), reason: match_reason })), traceId };
  });
});

app.post('/api/v1/memory/:id/redact', { preHandler: authenticate }, async (request, reply) => {
  const claims = request.user as { sub?: string; role?: string };
  if (!['owner','admin'].includes(claims.role ?? '')) return reply.code(403).send({ error: 'administrator_role_required' });
  const organizationId = tenant(request);
  const { id } = request.params as { id: string };
  const result = await withTenant(organizationId, async (db) => {
    const rows = await db.query(`WITH RECURSIVE affected(id) AS (
        SELECT id FROM memory_items WHERE id=$1
        UNION
        SELECT m.id FROM memory_items m JOIN affected a ON m.derived_from @> ARRAY[a.id]
      )
      UPDATE memory_items SET redacted_at=now(),content='{"redacted":true}'::jsonb,search_text='',embedding=NULL
      WHERE id IN (SELECT id FROM affected) RETURNING id`, [id]);
    if (!rows.rowCount) return 0;
    await db.query("INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'human',$2,'memory_redacted',$3,$4,$5,$6,$7)", [organizationId, claims.sub, `memory:${id}`, hash({ memoryId: id }), hash({ redactedCount: rows.rowCount }), crypto.randomUUID(), JSON.stringify({ redactedCount: rows.rowCount, embeddingsRemoved: true })]);
    return rows.rowCount;
  });
  if (!result) return reply.code(404).send({ error: 'memory_not_found' });
  return { redactedCount: result };
});

app.post('/api/v1/approvals/:id/decision', { preHandler: authenticate }, async (request, reply) => {
  const schema = z.object({ decision: z.enum(['approve','deny']), reason: z.string().trim().min(1).optional() });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_decision', issues: parsed.error.issues });
  if (parsed.data.decision === 'deny' && !parsed.data.reason) return reply.code(400).send({ error: 'deny_reason_required' });
  const organizationId = tenant(request);
  const claims = request.user as { sub?: string; role?: string };
  const { id } = request.params as { id: string };
  const result = await withTenant(organizationId, async (db) => {
    const row = await db.query("SELECT d.id,d.target_id,d.decision,d.action_type,d.policy_id,p.approvers FROM approval_decisions d JOIN approval_policies p ON p.id=d.policy_id WHERE d.id=$1 FOR UPDATE", [id]);
    if (!row.rowCount) return { missing: true as const };
    if (row.rows[0].decision !== 'pending') return { conflict: true as const };
    const approvers = row.rows[0].approvers as string[];
    if (!claims.role || !approvers.includes(claims.role)) return { forbidden: true as const };
    const decision = parsed.data.decision === 'approve' ? 'approved' : 'denied';
    await db.query('UPDATE approval_decisions SET decision=$2,approver_user_id=$3,reason=$4,decided_at=now() WHERE id=$1', [id, decision, claims.sub, parsed.data.reason ?? null]);
    await db.query('UPDATE quotes SET state=$2 WHERE id=$1', [row.rows[0].target_id, decision === 'approved' ? 'approved' : 'rejected']);
    const workflow = await db.query("SELECT id,trace_id FROM workflow_runs WHERE organization_id=$1 AND output #>> '{create_quote,quoteId}'=$2 LIMIT 1", [organizationId, row.rows[0].target_id]);
    if (workflow.rowCount) {
      await db.query("UPDATE tasks SET state='completed',updated_at=now() WHERE workflow_key=$1", [`${workflow.rows[0].id}:approval:${id}`]);
      if (decision === 'approved') {
        await db.query("UPDATE workflow_steps SET state='completed',output=jsonb_set(output,'{state}','\"approved\"'::jsonb,true),last_error=NULL,completed_at=now() WHERE workflow_run_id=$1 AND step_key='evaluate_quote_policy'", [workflow.rows[0].id]);
        await db.query("UPDATE workflow_runs SET state='queued',last_error=NULL,updated_at=now() WHERE id=$1", [workflow.rows[0].id]);
      } else {
        await db.query("UPDATE workflow_runs SET state='failed',last_error='quote denied by approver',updated_at=now() WHERE id=$1", [workflow.rows[0].id]);
        await db.query("UPDATE workflow_steps SET state='failed',last_error='quote denied by approver' WHERE workflow_run_id=$1 AND step_key='send_quote_email'", [workflow.rows[0].id]);
      }
      await db.query("INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,policy_id,approval_id,trace_id,details) VALUES ($1,'human',$2,'approval_decided',$3,$4,$5,$6,$7,$8,$9)", [organizationId, claims.sub, `approval:${id}`, hash({ decision: parsed.data.decision }), hash({ decision, reason: parsed.data.reason }), row.rows[0].policy_id, id, workflow.rows[0].trace_id, JSON.stringify({ policyVersion: 1, role: claims.role })]);
    }
    return { missing: false as const, workflowId: workflow.rows[0]?.id, decision };
  });
  if (result.missing) return reply.code(404).send({ error: 'approval_not_found' });
  if (result.conflict) return reply.code(409).send({ error: 'approval_already_decided' });
  if (result.forbidden) return reply.code(403).send({ error: 'approver_role_required' });
  if (result.decision === 'approved' && result.workflowId) await workflowQueue.add('run', { organizationId, workflowRunId: result.workflowId }, { jobId: `approval-${result.workflowId}-${Date.now()}` });
  return { decision: result.decision, workflowId: result.workflowId };
});

app.get('/api/v1/live', { websocket: true, preHandler: authenticate }, (socket, request) => {
  const organizationId = tenant(request);
  socket.send(JSON.stringify({ type: 'connected', organizationId }));
  const interval = setInterval(async () => {
    try {
      const result = await withTenant(organizationId, async (db) => db.query("SELECT id, workflow_type, state, updated_at FROM workflow_runs WHERE state IN ('queued','running','retrying','waiting_approval') ORDER BY updated_at DESC LIMIT 20"));
      socket.send(JSON.stringify({ type: 'workflow_status', runs: result.rows }));
    } catch { socket.close(); }
  }, 2000);
  socket.on('close', () => clearInterval(interval));
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error, trace_id: request.id }, 'request failed');
  reply.code(500).send({ error: 'internal_error', traceId: request.id });
});

const stop = async () => { await app.close(); await workflowQueue.close(); await redis.quit(); await pool.end(); };
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 4000) });
