import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;
const testUrl = process.env.TEST_DATABASE_URL;
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
const pool = testUrl ? new Pool({ connectionString: testUrl }) : null;
const adminPool = adminUrl ? new Pool({ connectionString: adminUrl }) : null;
const orgA = randomUUID();
const orgB = randomUUID();
const slugSuffix = randomUUID().slice(0, 8);

describe.skipIf(!pool)('PostgreSQL tenant isolation and audit integrity', () => {
  afterAll(async () => {
    if (adminPool) {
      const cleanup = await adminPool.connect();
      try {
        await cleanup.query('BEGIN');
        await cleanup.query('ALTER TABLE audit_events DISABLE TRIGGER audit_immutable');
        await cleanup.query('DELETE FROM audit_events WHERE organization_id = ANY($1::uuid[])', [[orgA, orgB]]);
        await cleanup.query('ALTER TABLE audit_events ENABLE TRIGGER audit_immutable');
        await cleanup.query('DELETE FROM contacts WHERE organization_id = ANY($1::uuid[])', [[orgA, orgB]]);
        await cleanup.query('DELETE FROM organizations WHERE organization_id = ANY($1::uuid[])', [[orgA, orgB]]);
        await cleanup.query('COMMIT');
      } catch (error) {
        await cleanup.query('ROLLBACK');
        throw error;
      } finally { cleanup.release(); }
    }
    await pool?.end();
    await adminPool?.end();
  });

  it('hides other tenants, rejects cross-tenant writes, and detects privileged audit tampering', async () => {
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.organization_id',$1,true)", [orgA]);
      await client.query('INSERT INTO organizations (id,organization_id,name,slug) VALUES ($1,$1,$2,$3)', [orgA, 'Isolation A', `isolation-a-${slugSuffix}`]);
      await client.query("SELECT set_config('app.organization_id',$1,true)", [orgB]);
      await client.query('INSERT INTO organizations (id,organization_id,name,slug) VALUES ($1,$1,$2,$3)', [orgB, 'Isolation B', `isolation-b-${slugSuffix}`]);

      await client.query("SELECT set_config('app.organization_id',$1,true)", [orgA]);
      await client.query("INSERT INTO contacts (organization_id,first_name,email,source) VALUES ($1,'A','a@example.test','test')", [orgA]);
      await client.query("SELECT set_config('app.organization_id',$1,true)", [orgB]);
      await client.query("INSERT INTO contacts (organization_id,first_name,email,source) VALUES ($1,'B','b@example.test','test')", [orgB]);
      await client.query("SELECT set_config('app.organization_id',$1,true)", [orgA]);
      const visible = await client.query('SELECT first_name FROM contacts ORDER BY first_name');
      expect(visible.rows.map((row) => row.first_name)).toEqual(['A']);
      await client.query('SAVEPOINT cross_tenant_write');
      await expect(client.query("INSERT INTO contacts (organization_id,first_name,source) VALUES ($1,'forbidden','test')", [orgB])).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK TO SAVEPOINT cross_tenant_write');

      const traceId = randomUUID();
      const audit = await client.query("INSERT INTO audit_events (organization_id,actor_type,action,target,inputs_hash,outputs_hash,trace_id) VALUES ($1,'system','test_event','fixture','in','out',$2) RETURNING id", [orgA, traceId]);
      expect((await client.query('SELECT aios_verify_audit_chain($1) AS valid', [orgA])).rows[0].valid).toBe(true);
      await client.query('SAVEPOINT append_only');
      await expect(client.query("UPDATE audit_events SET outputs_hash='changed' WHERE id=$1", [audit.rows[0].id])).rejects.toThrow(/append-only/);
      await client.query('ROLLBACK TO SAVEPOINT append_only');
      await client.query('COMMIT');

      if (adminPool) {
        const admin = await adminPool.connect();
        try {
          await admin.query('ALTER TABLE audit_events DISABLE TRIGGER audit_immutable');
          await admin.query("UPDATE audit_events SET outputs_hash='privileged-tamper' WHERE id=$1", [audit.rows[0].id]);
          await admin.query('ALTER TABLE audit_events ENABLE TRIGGER audit_immutable');
        } finally { admin.release(); }
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.organization_id',$1,true)", [orgA]);
        expect((await client.query('SELECT aios_verify_audit_chain($1) AS valid', [orgA])).rows[0].valid).toBe(false);
        await client.query('ROLLBACK');
      }
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* transaction already ended */ }
      throw error;
    } finally { client.release(); }
  });
});
