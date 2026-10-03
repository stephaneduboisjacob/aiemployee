import pg from 'pg';
import { employeeTemplates } from '../packages/core/src/employees.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const orgId = process.env.DEMO_ORG_ID ?? '11111111-1111-4111-8111-111111111111';

async function main() {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.organization_id', $1, true)", [orgId]);
    await db.query("INSERT INTO organizations (id,organization_id,name,slug,vertical_pack,settings) VALUES ($1,$1,'CoolAir HVAC Demo','hvac-demo','hvac-field-service',$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,vertical_pack=EXCLUDED.vertical_pack,settings=EXCLUDED.settings", [orgId, JSON.stringify({ currency: 'USD', quoteAutoApprovalLimitCents: 50000, emailMode: 'local-smtp', crmPipeline: 'Residential service', transcriptRetention: true })]);
    const users = [
      ['22222222-2222-4222-8222-222222222222', 'owner@example.test', 'Morgan Owner', 'owner'],
      ['33333333-3333-4333-8333-333333333333', 'sales@example.test', 'Taylor Sales', 'manager'],
      ['44444444-4444-4444-8444-444444444444', 'dispatch@example.test', 'Jordan Dispatcher', 'employee'],
    ] as const;
    for (const [id, email, displayName, role] of users) {
      await db.query("INSERT INTO human_users (id,organization_id,email,display_name,role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id,email) DO UPDATE SET display_name=EXCLUDED.display_name,role=EXCLUDED.role,active=true", [id, orgId, email, displayName, role]);
    }
    for (const template of employeeTemplates) {
      await db.query(
        "INSERT INTO digital_employees (organization_id,name,role,owner_user_id,avatar,system_prompt,prompt_version,capabilities,memory_scope,working_hours,escalation_contact,approval_defaults) VALUES ($1,$2,$3,$4,$5,$6,'1.0.0',$7,$8,$9,$10,$11) ON CONFLICT (organization_id,role) DO UPDATE SET system_prompt=EXCLUDED.system_prompt,capabilities=EXCLUDED.capabilities,memory_scope=EXCLUDED.memory_scope,approval_defaults=EXCLUDED.approval_defaults,state='active'",
        [orgId, template.title, template.role, users[0][0], template.role === 'receptionist' ? '☎️' : template.role === 'sales_assistant' ? '📈' : template.role === 'ar_clerk' ? '🧾' : template.role === 'support_technician' ? '🛠️' : '📦', template.systemPrompt, JSON.stringify(template.capabilities), JSON.stringify(template.memoryScope), JSON.stringify({ timezone: 'America/Chicago', days: ['monday','tuesday','wednesday','thursday','friday'], start: '08:00', end: '17:00' }), users[2][1], JSON.stringify(template.approvalDefaults)],
      );
    }
    await db.query("INSERT INTO organization_locations (organization_id,name,timezone,address) VALUES ($1,'Main Service Area','America/Chicago',$2) ON CONFLICT DO NOTHING", [orgId, JSON.stringify({ city: 'Austin', region: 'TX' })]);
    await db.query("INSERT INTO phone_numbers (organization_id,e164,provider,purpose) VALUES ($1,'+15550100100','local-simulator','receptionist') ON CONFLICT (organization_id,e164) DO NOTHING", [orgId]);
    await db.query("INSERT INTO email_accounts (organization_id,address,provider) VALUES ($1,'service@hvac-demo.example.test','mailpit') ON CONFLICT (organization_id,address) DO NOTHING", [orgId]);
    const salesId = await db.query("SELECT id FROM digital_employees WHERE organization_id=$1 AND role='sales_assistant'", [orgId]);
    await db.query("INSERT INTO calendars (organization_id,employee_id,name,provider,working_hours,travel_buffer_minutes) VALUES ($1,$2,'HVAC Visits','local-calendar',$3,30) ON CONFLICT DO NOTHING", [orgId, salesId.rows[0].id, JSON.stringify({ timezone: 'America/Chicago', days: ['monday','tuesday','wednesday','thursday','friday'], start: '08:00', end: '17:00' })]);
    await db.query("INSERT INTO organization_integrations (organization_id,provider,state,settings) VALUES ($1,'built-in-crm','connected','{}'),($1,'mailpit','connected','{}'),($1,'local-calendar','connected','{}'),($1,'hubspot','disconnected','{}'),($1,'twilio','disconnected','{}'),($1,'stripe','disconnected','{}') ON CONFLICT (organization_id,provider) DO NOTHING", [orgId]);
    for (const [position, name] of ['New lead','Qualified','Visit booked','Quote sent','Won','Lost'].entries()) {
      await db.query('INSERT INTO pipeline_stages (organization_id,name,position,terminal) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,position) DO NOTHING', [orgId, name, position, ['Won','Lost'].includes(name)]);
    }
    for (const [name, matcher, decision, approvers] of [
      ['quote-under-500', { action: 'send_quote', maxAmountCents: 50000 }, 'auto_approve', []],
      ['quote-500-to-5000', { action: 'send_quote', minAmountCents: 50001, maxAmountCents: 500000 }, 'require_approval', ['manager']],
      ['quote-over-5000', { action: 'send_quote', minAmountCents: 500001 }, 'require_approval', ['owner']],
      ['refund-under-100', { action: 'refund', maxAmountCents: 10000 }, 'auto_approve', []],
      ['refund-over-100', { action: 'refund', minAmountCents: 10001 }, 'require_approval', ['manager']],
      ['new-vendor-po', { action: 'vendor_purchase_order', isNewVendor: true }, 'require_approval', ['owner']],
      ['campaign-over-50', { action: 'outbound_campaign', minRecipients: 51 }, 'require_approval', ['owner']],
    ] as const) {
      await db.query("INSERT INTO approval_policies (organization_id,name,matcher,decision,approvers) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id,name,version) DO NOTHING", [orgId, name, JSON.stringify(matcher), decision, JSON.stringify(approvers)]);
    }
    await db.query("INSERT INTO service_catalog (organization_id,sku,name,description,duration_minutes,base_price_cents) VALUES ($1,'HVAC-DIAG','HVAC diagnostic visit','On-site system diagnosis',60,12900),($1,'HVAC-CAP-REPAIR','Capacitor replacement allowance','Common AC capacitor replacement, pending technician diagnosis',60,30000) ON CONFLICT (organization_id,sku) DO NOTHING", [orgId]);
    await db.query("INSERT INTO vendors (organization_id,name,email,approved,terms) VALUES ($1,'Lone Star HVAC Supply','orders@hvac-supply.example.test',true,$2) ON CONFLICT (organization_id,name) DO NOTHING", [orgId, JSON.stringify({ paymentDays: 30, region: 'Central Texas' })]);
    await db.query("INSERT INTO inventory_items (organization_id,sku,name,quantity,reorder_point,unit) VALUES ($1,'CAP-45-5','45/5 µF dual run capacitor',8,4,'each'),($1,'FILTER-20-25','20x25 HVAC air filter',20,8,'each') ON CONFLICT (organization_id,sku) DO NOTHING", [orgId]);
    await db.query('COMMIT');
    process.stdout.write(`Seeded HVAC demo organization ${orgId}\n`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); await pool.end(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
