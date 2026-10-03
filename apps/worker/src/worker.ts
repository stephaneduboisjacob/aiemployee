import { Worker, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { createHash } from 'node:crypto';
import { evaluateApproval } from '@aios/core/policy';
import { qualifyHvacCaller } from '@aios/core/hvac';
import { inboundLeadToQuoteWorkflow } from '@aios/workflows/hvac';

type QueuePayload = { organizationId: string; workflowRunId: string };
type OutputMap = Record<string, Record<string, unknown>>;
type CallInput = { caller: { name: string; phone: string; email: string; address: string; city: string; region: string; postalCode: string; issue: string; preferredWindow?: string }; transcript?: string; receptionistId: string; failOnceStep?: string };
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, application_name: 'ai-employee-os-worker' });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const retryQueue = new Queue('aios-workflows', { connection: redis, defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 } });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function withTenant<T>(organizationId: string, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const output = await fn(db);
    await db.query('COMMIT');
    return output;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
}

async function addAudit(db: pg.PoolClient, organizationId: string, actorId: string, action: string, target: string, input: unknown, output: unknown, traceId: string, details: Record<string, unknown> = {}) {
  await db.query(
    "INSERT INTO audit_events (organization_id,actor_type,actor_id,action,target,inputs_hash,outputs_hash,trace_id,details) VALUES ($1,'employee',$2,$3,$4,$5,$6,$7,$8)",
    [organizationId, actorId, action, target, hash(input), hash(output), traceId, JSON.stringify(details)],
  );
}

async function event(db: pg.PoolClient, organizationId: string, runId: string, stepKey: string, eventType: string, payload: unknown) {
  await db.query('INSERT INTO workflow_events (organization_id,workflow_run_id,step_key,event_type,payload) VALUES ($1,$2,$3,$4,$5)', [organizationId, runId, stepKey, eventType, JSON.stringify(payload)]);
}

function output(outputs: OutputMap, key: string): Record<string, unknown> {
  const value = outputs[key];
  if (!value) throw new Error(`Required workflow output is missing: ${key}`);
  return value;
}

async function performStep(organizationId: string, run: { id: string; trace_id: string; interaction_id: string; input: CallInput }, key: string, outputs: OutputMap) {
  const input = run.input;
  return withTenant(organizationId, async (db) => {
    if (key === 'qualify_call') {
      const result = { caller: input.caller, ...qualifyHvacCaller(input.caller) };
      await addAudit(db, organizationId, input.receptionistId, 'lead_qualified', `interaction:${run.interaction_id}`, { transcript: input.transcript }, result, run.trace_id, { promptVersion: 'hvac-receptionist-1.0.0' });
      await db.query("UPDATE interactions SET outcome=$2 WHERE id=$1", [run.interaction_id, result.safetyEscalation ? 'safety_escalated' : 'lead_qualified']);
      if (result.safetyEscalation) {
        const owner = await db.query("SELECT id FROM human_users WHERE role IN ('owner','manager') AND active=true ORDER BY CASE WHEN role='manager' THEN 0 ELSE 1 END LIMIT 1");
        const task = await db.query("INSERT INTO tasks (organization_id,title,description,state,assigned_human_id,priority,interaction_id,workflow_key) VALUES ($1,'Immediate HVAC safety escalation',$2,'escalated',$3,'urgent',$4,$5) ON CONFLICT (organization_id,workflow_key) DO UPDATE SET description=EXCLUDED.description RETURNING id", [organizationId, `Caller reports ${result.safetyReason}. Do not book a routine visit; call the customer now and follow the company emergency procedure.`, owner.rows[0]?.id ?? null, run.interaction_id, `${run.id}:safety-escalation`]);
        await addAudit(db, organizationId, input.receptionistId, 'safety_escalated_to_human', `task:${task.rows[0].id}`, { issue: input.caller.issue }, { employeeAction: 'stopped_routine_booking', taskId: task.rows[0].id }, run.trace_id, { reason: result.safetyReason });
      }
      return result;
    }
    if (key === 'create_contact_and_property') {
      const caller = input.caller;
      const contact = await db.query(
        "INSERT INTO contacts (organization_id,first_name,last_name,email,phone,source,created_by_employee_id,created_by_task_id,confidence) VALUES ($1,$2,$3,$4,$5,'phone',$6,$7,0.98) ON CONFLICT (organization_id,phone) WHERE phone IS NOT NULL DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,email=EXCLUDED.email,updated_at=now() RETURNING id",
        [organizationId, caller.name.trim().split(/\s+/)[0], caller.name.trim().split(/\s+/).slice(1).join(' '), caller.email, caller.phone, input.receptionistId, run.id],
      );
      const property = await db.query(
        "INSERT INTO properties (organization_id,contact_id,address_line1,city,region,postal_code,source,created_by_employee_id,created_by_task_id,confidence) VALUES ($1,$2,$3,$4,$5,$6,'phone',$7,$8,0.96) ON CONFLICT (organization_id,address_line1,postal_code) DO UPDATE SET contact_id=EXCLUDED.contact_id RETURNING id",
        [organizationId, contact.rows[0].id, caller.address, caller.city, caller.region, caller.postalCode, input.receptionistId, run.id],
      );
      const deal = await db.query("INSERT INTO deals (organization_id,contact_id,name,stage,amount_cents) VALUES ($1,$2,$3,'qualified',42900) ON CONFLICT (organization_id,name) DO UPDATE SET contact_id=EXCLUDED.contact_id RETURNING id", [organizationId, contact.rows[0].id, `${caller.name} - HVAC service`]);
      await db.query("INSERT INTO memory_items (organization_id,kind,entity_id,scope,content,search_text,provenance_employee_id,provenance_task_id,source,confidence) VALUES ($1,'contact',$2,'shared', $3,$4,$5,$6,'phone',0.98) ON CONFLICT (organization_id,kind,entity_id,provenance_task_id) WHERE entity_id IS NOT NULL AND provenance_task_id IS NOT NULL DO UPDATE SET content=EXCLUDED.content,search_text=EXCLUDED.search_text", [organizationId, contact.rows[0].id, JSON.stringify({ name: caller.name, email: caller.email, phone: caller.phone }), `${caller.name} HVAC lead ${caller.phone}`, input.receptionistId, run.id]);
      await addAudit(db, organizationId, input.receptionistId, 'memory_item_written', `memory:contact:${contact.rows[0].id}`, { kind: 'contact', source: 'phone' }, { entityId: contact.rows[0].id, confidence: 0.98 }, run.trace_id, { taskId: run.id, scope: 'shared' });
      const result = { contactId: contact.rows[0].id, propertyId: property.rows[0].id, dealId: deal.rows[0].id };
      await addAudit(db, organizationId, input.receptionistId, 'crm_contact_property_created', `contact:${result.contactId}`, { caller }, result, run.trace_id, { source: 'phone', confidence: 0.98 });
      return result;
    }
    if (key === 'book_visit') {
      const ids = output(outputs, 'create_contact_and_property');
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 1);
      start.setUTCHours(10, 0, 0, 0);
      while ([0, 6].includes(start.getUTCDay())) start.setUTCDate(start.getUTCDate() + 1);
      const startIso = start.toISOString();
      const endIso = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
      const eventId = `local-${run.id}`;
      const appointment = await db.query(
        "INSERT INTO appointments (organization_id,contact_id,property_id,service_code,starts_at,ends_at,calendar_event_id) VALUES ($1,$2,$3,'HVAC_DIAGNOSTIC',$4,$5,$6) ON CONFLICT (organization_id,calendar_event_id) WHERE calendar_event_id IS NOT NULL DO UPDATE SET starts_at=EXCLUDED.starts_at RETURNING id,starts_at,ends_at",
        [organizationId, ids.contactId, ids.propertyId, startIso, endIso, eventId],
      );
      await db.query("INSERT INTO memory_items (organization_id,kind,entity_id,scope,content,search_text,provenance_employee_id,provenance_task_id,source,confidence) VALUES ($1,'service_visit',$2,'receptionist',$3,$4,$5,$6,'phone',0.95) ON CONFLICT (organization_id,kind,entity_id,provenance_task_id) WHERE entity_id IS NOT NULL AND provenance_task_id IS NOT NULL DO UPDATE SET content=EXCLUDED.content,search_text=EXCLUDED.search_text", [organizationId, appointment.rows[0].id, JSON.stringify({ serviceCode: 'HVAC_DIAGNOSTIC', startsAt: appointment.rows[0].starts_at }), `${input.caller.name} HVAC diagnostic appointment`, input.receptionistId, run.id]);
      await addAudit(db, organizationId, input.receptionistId, 'memory_item_written', `memory:service_visit:${appointment.rows[0].id}`, { kind: 'service_visit', source: 'phone' }, { entityId: appointment.rows[0].id, confidence: 0.95 }, run.trace_id, { taskId: run.id, scope: 'receptionist' });
      const result = { appointmentId: appointment.rows[0].id, startsAt: appointment.rows[0].starts_at, endsAt: appointment.rows[0].ends_at };
      await addAudit(db, organizationId, input.receptionistId, 'calendar_visit_booked', `appointment:${result.appointmentId}`, { caller: input.caller }, result, run.trace_id, { adapter: 'local-calendar' });
      return result;
    }
    if (key === 'handoff_to_sales') {
      const sales = await db.query("SELECT id FROM digital_employees WHERE role='sales_assistant' AND state='active' LIMIT 1");
      if (!sales.rowCount) throw new Error('No active sales assistant is hired');
      const ids = output(outputs, 'create_contact_and_property');
      const booking = output(outputs, 'book_visit');
      const task = await db.query("INSERT INTO tasks (organization_id,title,description,owner_employee_id,sla_due_at,interaction_id,workflow_key) VALUES ($1,$2,$3,$4,date_trunc('day',now()) + interval '18 hours',$5,$6) ON CONFLICT (organization_id,workflow_key) DO UPDATE SET description=EXCLUDED.description RETURNING id", [organizationId, `Prepare HVAC quote for ${input.caller.name}`, `Visit ${booking.startsAt} at ${input.caller.address}. Issue: ${input.caller.issue}. Prepare quote from the approved HVAC catalog.`, sales.rows[0].id, run.interaction_id, `${run.id}:sales-quote`]);
      await db.query("INSERT INTO handoffs (organization_id,from_employee_id,to_employee_id,task_id,handoff_type,goal,constraints,deadline,artifacts,reason) VALUES ($1,$2,$3,$4,'quote_after_visit','Prepare and send an HVAC service quote', $5,date_trunc('day',now()) + interval '18 hours',$6,'Receptionist qualified the caller and booked a service visit') ON CONFLICT (organization_id,task_id,handoff_type) DO NOTHING", [organizationId, input.receptionistId, sales.rows[0].id, task.rows[0].id, JSON.stringify({ priceSource: 'approved_service_catalog', maxDiscountPercent: 0 }), JSON.stringify([{ kind: 'contact', id: ids.contactId }, { kind: 'property', id: ids.propertyId }, { kind: 'appointment', id: booking.appointmentId }])]);
      const result = { taskId: task.rows[0].id, toEmployeeId: sales.rows[0].id };
      await addAudit(db, organizationId, input.receptionistId, 'employee_handoff_created', `task:${result.taskId}`, { from: input.receptionistId, goal: 'prepare_quote' }, result, run.trace_id, { handoffType: 'quote_after_visit' });
      return result;
    }
    if (key === 'create_quote') {
      const ids = output(outputs, 'create_contact_and_property');
      const handoff = output(outputs, 'handoff_to_sales');
      const quoteNo = `HVAC-${run.id.slice(0, 8).toUpperCase()}`;
      const quote = await db.query("INSERT INTO quotes (organization_id,deal_id,contact_id,task_id,quote_number,amount_cents,line_items,state) VALUES ($1,$2,$3,$4,$5,42900,$6,'draft') ON CONFLICT (organization_id,quote_number) DO UPDATE SET quote_number=EXCLUDED.quote_number RETURNING id,quote_number,amount_cents,state", [organizationId, ids.dealId, ids.contactId, handoff.taskId, quoteNo, JSON.stringify([{ sku: 'HVAC-DIAG', description: 'HVAC diagnostic visit', quantity: 1, unitPriceCents: 12900 }, { sku: 'HVAC-CAP-REPAIR', description: 'Capacitor replacement allowance', quantity: 1, unitPriceCents: 30000 }])]);
      const result = { quoteId: quote.rows[0].id, quoteNumber: quote.rows[0].quote_number, amountCents: quote.rows[0].amount_cents };
      await addAudit(db, organizationId, String(handoff.toEmployeeId), 'quote_drafted', `quote:${result.quoteId}`, { issue: input.caller.issue }, result, run.trace_id, { catalog: 'hvac-demo-catalog-v1' });
      return result;
    }
    if (key === 'evaluate_quote_policy') {
      const quoteInfo = output(outputs, 'create_quote');
      const employee = await db.query("SELECT id FROM digital_employees WHERE role='sales_assistant' LIMIT 1");
      const quote = await db.query('SELECT amount_cents FROM quotes WHERE id=$1', [quoteInfo.quoteId]);
      const policy = evaluateApproval({ role: 'sales_assistant', actionType: 'send_quote', amountCents: Number(quote.rows[0].amount_cents) });
      const policyRow = await db.query('SELECT id,version FROM approval_policies WHERE name=$1 ORDER BY version DESC LIMIT 1', [policy.policyName]);
      const state = policy.decision === 'auto_approve' ? 'auto_approved' : policy.decision === 'deny' ? 'denied' : 'pending';
      const decision = await db.query("INSERT INTO approval_decisions (organization_id,policy_id,action_type,target_id,decision,inputs,policy_version,expires_at,decided_at) VALUES ($1,$2,'send_quote',$3,$4,$5,$6,now()+interval '24 hours',CASE WHEN $4='auto_approved' THEN now() ELSE NULL END) ON CONFLICT (organization_id,action_type,target_id) DO UPDATE SET decision=approval_decisions.decision RETURNING id,decision", [organizationId, policyRow.rows[0].id, quoteInfo.quoteId, state, JSON.stringify({ amountCents: Number(quote.rows[0].amount_cents), role: 'sales_assistant' }), policyRow.rows[0].version]);
      const effectiveState = decision.rows[0].decision as string;
      await db.query('UPDATE quotes SET state=$2,approval_decision_id=$3 WHERE id=$1', [quoteInfo.quoteId, effectiveState === 'auto_approved' || effectiveState === 'approved' ? 'approved' : effectiveState === 'denied' ? 'rejected' : 'waiting_approval', decision.rows[0].id]);
      if (effectiveState === 'pending') {
        await db.query("UPDATE workflow_steps SET state='waiting_approval',output=$2 WHERE workflow_run_id=$1 AND step_key='evaluate_quote_policy'", [run.id, JSON.stringify({ ...policy, approvalDecisionId: decision.rows[0].id })]);
        await db.query("UPDATE workflow_runs SET state='waiting_approval',updated_at=now() WHERE id=$1", [run.id]);
        const approverRole = policy.approvers[0];
        const approver = await db.query('SELECT id FROM human_users WHERE role=$1 AND active=true ORDER BY created_at LIMIT 1', [approverRole]);
        if (approver.rowCount) await db.query("INSERT INTO tasks (organization_id,title,description,state,assigned_human_id,priority,interaction_id,workflow_key) VALUES ($1,$2,$3,'waiting_approval',$4,'high',$5,$6) ON CONFLICT (organization_id,workflow_key) DO NOTHING", [organizationId, `Approval required: quote ${quoteInfo.quoteId}`, `Policy ${policy.policyName} requires ${approverRole} approval before sending this quote.`, approver.rows[0].id, run.interaction_id, `${run.id}:approval:${decision.rows[0].id}`]);
      }
      await addAudit(db, organizationId, String(employee.rows[0].id), 'approval_policy_decided', `quote:${quoteInfo.quoteId}`, { amountCents: Number(quote.rows[0].amount_cents), actionType: 'send_quote' }, { ...policy, approvalDecisionId: decision.rows[0].id }, run.trace_id, { policyId: policyRow.rows[0].id, approvalId: decision.rows[0].id, policyVersion: policyRow.rows[0].version });
      return { ...policy, approvalDecisionId: decision.rows[0].id, state: effectiveState };
    }
    if (key === 'send_quote_email') {
      const quoteInfo = output(outputs, 'create_quote');
      const decision = output(outputs, 'evaluate_quote_policy');
      if (decision.state === 'pending') throw new Error('Quote is waiting for approval');
      if (decision.state === 'denied') throw new Error('Quote was denied');
      const customer = await db.query("SELECT c.email,c.first_name,q.quote_number,q.amount_cents,q.line_items FROM quotes q JOIN contacts c ON c.id=q.contact_id WHERE q.id=$1", [quoteInfo.quoteId]);
      const amount = (Number(customer.rows[0].amount_cents) / 100).toFixed(2);
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST ?? 'localhost', port: Number(process.env.SMTP_PORT ?? 1025), secure: false });
      const subject = `Your HVAC service quote ${customer.rows[0].quote_number}`;
      const body = `Hi ${customer.rows[0].first_name},\n\nThanks for calling about ${input.caller.issue}. We have your HVAC diagnostic visit booked. Your estimate ${customer.rows[0].quote_number} totals $${amount}, based on the attached service line items. We will confirm any repair work after diagnosis.\n\nReply to this email if you have questions.\n`;
      const sent = await transport.sendMail({ from: process.env.SMTP_FROM ?? 'hvac-demo@example.test', to: customer.rows[0].email, subject, text: body });
      const message = await db.query("INSERT INTO outbound_messages (organization_id,interaction_id,task_id,channel,recipient,subject,body,state,provider_id,sent_at,workflow_key) VALUES ($1,$2,$3,'email',$4,$5,$6,'sent',$7,now(),$8) ON CONFLICT (organization_id,workflow_key) DO UPDATE SET state='sent',provider_id=EXCLUDED.provider_id,sent_at=coalesce(outbound_messages.sent_at,now()) RETURNING id", [organizationId, run.interaction_id, output(outputs, 'handoff_to_sales').taskId, customer.rows[0].email, subject, body, sent.messageId, `${run.id}:send-quote-email`]);
      const result = { messageId: message.rows[0].id, providerMessageId: sent.messageId, recipient: customer.rows[0].email };
      await addAudit(db, organizationId, input.receptionistId, 'quote_email_sent', `message:${result.messageId}`, { recipient: customer.rows[0].email, quoteId: quoteInfo.quoteId }, { providerMessageId: sent.messageId }, run.trace_id, { channel: 'email' });
      return result;
    }
    if (key === 'schedule_follow_up') {
      const ids = output(outputs, 'create_contact_and_property');
      const sales = await db.query("SELECT id FROM digital_employees WHERE role='sales_assistant' LIMIT 1");
      const task = await db.query("INSERT INTO tasks (organization_id,title,description,state,owner_employee_id,sla_due_at,interaction_id,workflow_key) VALUES ($1,$2,$3,'open',$4,now()+interval '2 days',$5,$6) ON CONFLICT (organization_id,workflow_key) DO UPDATE SET description=EXCLUDED.description RETURNING id,sla_due_at", [organizationId, `Follow up with ${input.caller.name}`, 'Check that the customer received the HVAC quote and answer questions.', sales.rows[0].id, run.interaction_id, `${run.id}:follow-up`]);
      const result = { taskId: task.rows[0].id, contactId: ids.contactId, dueAt: task.rows[0].sla_due_at };
      await addAudit(db, organizationId, sales.rows[0].id, 'follow_up_scheduled', `task:${result.taskId}`, { contactId: ids.contactId }, result, run.trace_id);
      return result;
    }
    if (key === 'alert_salesperson') {
      const owner = await db.query("SELECT id FROM human_users WHERE role IN ('owner','manager') AND active=true ORDER BY CASE WHEN role='manager' THEN 0 ELSE 1 END LIMIT 1");
      const handoff = output(outputs, 'handoff_to_sales');
      const sentEmail = output(outputs, 'send_quote_email');
      const task = await db.query("INSERT INTO tasks (organization_id,title,description,state,assigned_human_id,priority,interaction_id,workflow_key) VALUES ($1,$2,$3,'open',$4,'high',$5,$6) ON CONFLICT (organization_id,workflow_key) DO UPDATE SET description=EXCLUDED.description RETURNING id", [organizationId, `Sales alert: ${input.caller.name} has a booked HVAC visit`, `Visit booked. Quote emailed to ${sentEmail.recipient}. Quote owner task: ${handoff.taskId}. Follow-up is scheduled.`, owner.rows[0].id, run.interaction_id, `${run.id}:sales-alert`]);
      const result = { humanTaskId: task.rows[0].id, assignedHumanId: owner.rows[0].id };
      await addAudit(db, organizationId, handoff.toEmployeeId as string, 'human_salesperson_alerted', `task:${result.humanTaskId}`, { contact: input.caller.name }, result, run.trace_id, { priority: 'high' });
      return result;
    }
    throw new Error(`Unsupported HVAC workflow step: ${key}`);
  });
}

async function processRun(payload: QueuePayload) {
  for (;;) {
    const claimed = await withTenant(payload.organizationId, async (db) => {
      const runResult = await db.query('SELECT id,trace_id,interaction_id,input,output,state FROM workflow_runs WHERE id=$1 FOR UPDATE', [payload.workflowRunId]);
      if (!runResult.rowCount || ['completed','failed','cancelled'].includes(runResult.rows[0].state)) return null;
      const run = runResult.rows[0] as { id: string; trace_id: string; interaction_id: string; input: CallInput; output: OutputMap; state: string };
      const stepResult = await db.query("SELECT id,step_key,state,attempts FROM workflow_steps WHERE workflow_run_id=$1 AND state NOT IN ('completed','skipped') ORDER BY step_order LIMIT 1 FOR UPDATE", [run.id]);
      if (!stepResult.rowCount) {
        await db.query("UPDATE workflow_runs SET state='completed',updated_at=now() WHERE id=$1", [run.id]);
        await db.query("UPDATE interactions SET outcome='visit_booked_quote_emailed' WHERE id=$1", [run.interaction_id]);
        return null;
      }
      const step = stepResult.rows[0] as { id: string; step_key: string; state: string; attempts: number };
      if (step.state === 'waiting_approval') {
        await db.query("UPDATE workflow_runs SET state='waiting_approval',updated_at=now() WHERE id=$1", [run.id]);
        return null;
      }
      if (step.attempts >= 5) {
        await db.query("UPDATE workflow_runs SET state='failed',last_error='step retry limit exceeded',updated_at=now() WHERE id=$1", [run.id]);
        await db.query("UPDATE workflow_steps SET state='failed',last_error='step retry limit exceeded' WHERE id=$1", [step.id]);
        return null;
      }
      await db.query("UPDATE workflow_runs SET state='running',lease_until=now()+interval '60 seconds',attempts=attempts+1,updated_at=now() WHERE id=$1", [run.id]);
      await db.query("UPDATE workflow_steps SET state='running',attempts=attempts+1,started_at=coalesce(started_at,now()),lease_until=now()+interval '60 seconds' WHERE id=$1", [step.id]);
      const outputsResult = await db.query('SELECT step_key,output FROM workflow_steps WHERE workflow_run_id=$1 AND state=\'completed\' ORDER BY step_order', [run.id]);
      const outputs = Object.fromEntries(outputsResult.rows.map((row: { step_key: string; output: Record<string, unknown> }) => [row.step_key, row.output])) as OutputMap;
      return { run, step, outputs };
    });
    if (!claimed) return;

    const { run, step, outputs } = claimed;
    try {
      if (run.input.failOnceStep === step.step_key && step.attempts === 0) throw new Error(`Injected one-time failure at ${step.step_key}`);
      const result = await performStep(payload.organizationId, run, step.step_key, outputs);
      if (step.step_key === 'evaluate_quote_policy' && 'state' in result && result.state === 'pending') return;
      const more = await withTenant(payload.organizationId, async (db) => {
        await db.query("UPDATE workflow_steps SET state='completed',output=$2,last_error=NULL,completed_at=now(),lease_until=NULL WHERE id=$1", [step.id, JSON.stringify(result)]);
        await db.query('UPDATE workflow_runs SET output=jsonb_set(output,ARRAY[$2]::text[],$3::jsonb,true),last_error=NULL,updated_at=now() WHERE id=$1', [run.id, step.step_key, JSON.stringify(result)]);
        await event(db, payload.organizationId, run.id, step.step_key, 'step_completed', result);
        await addAudit(db, payload.organizationId, run.input.receptionistId, 'workflow_step_completed', `workflow:${run.id}/${step.step_key}`, { step: step.step_key }, result, run.trace_id, { workflowType: inboundLeadToQuoteWorkflow.type, version: inboundLeadToQuoteWorkflow.version, attempt: step.attempts + 1 });
        if (step.step_key === 'qualify_call' && 'safetyEscalation' in result && result.safetyEscalation) {
          await db.query("UPDATE workflow_steps SET state='skipped',output=$2,completed_at=now() WHERE workflow_run_id=$1 AND step_order>1", [run.id, JSON.stringify({ reason: 'human safety escalation' })]);
          await db.query("UPDATE workflow_runs SET state='completed',lease_until=NULL,updated_at=now() WHERE id=$1", [run.id]);
          await db.query("UPDATE interactions SET outcome='safety_escalated' WHERE id=$1", [run.interaction_id]);
          return false;
        }
        const pending = await db.query("SELECT 1 FROM workflow_steps WHERE workflow_run_id=$1 AND state NOT IN ('completed','skipped') LIMIT 1", [run.id]);
        if (!pending.rowCount) {
          await db.query("UPDATE workflow_runs SET state='completed',lease_until=NULL,updated_at=now() WHERE id=$1", [run.id]);
          await db.query("UPDATE interactions SET outcome='visit_booked_quote_emailed' WHERE id=$1", [run.interaction_id]);
          return false;
        }
        return true;
      });
      if (!more) return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempt = step.attempts + 1;
      await withTenant(payload.organizationId, async (db) => {
        await db.query("UPDATE workflow_steps SET state='failed',last_error=$2,next_attempt_at=now()+interval '2 seconds',lease_until=NULL WHERE id=$1", [step.id, message]);
        await db.query("UPDATE workflow_runs SET state='retrying',last_error=$2,updated_at=now() WHERE id=$1", [run.id, message]);
        await event(db, payload.organizationId, run.id, step.step_key, 'step_failed_retry_scheduled', { error: message, attempt, retryInSeconds: 2 });
        await addAudit(db, payload.organizationId, run.input.receptionistId, 'workflow_step_failed', `workflow:${run.id}/${step.step_key}`, { step: step.step_key, attempt }, { error: message, retryScheduled: true }, run.trace_id, { workflowType: inboundLeadToQuoteWorkflow.type });
      });
      await retryQueue.add('run', payload, { delay: 2200, jobId: `retry-${run.id}-${step.step_key}-${attempt}` });
      return;
    }
  }
}

const worker = new Worker<QueuePayload>('aios-workflows', async (job) => processRun(job.data), { connection: redis, concurrency: 5 });
worker.on('failed', (job, error) => console.error(JSON.stringify({ level: 'error', event: 'queue_job_failed', jobId: job?.id, message: error.message })));
worker.on('completed', (job) => console.log(JSON.stringify({ level: 'info', event: 'queue_job_completed', jobId: job.id })));
console.log(JSON.stringify({ level: 'info', event: 'worker_started', workflow: inboundLeadToQuoteWorkflow.type }));

async function stop() { await worker.close(); await retryQueue.close(); await redis.quit(); await pool.end(); process.exit(0); }
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
