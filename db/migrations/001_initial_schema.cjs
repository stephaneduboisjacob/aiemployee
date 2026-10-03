exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL UNIQUE,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      vertical_pack text NOT NULL DEFAULT 'hvac-field-service',
      settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      retention_days integer NOT NULL DEFAULT 365,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (organization_id = id)
    );
    CREATE TABLE human_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      email text NOT NULL, display_name text NOT NULL, role text NOT NULL CHECK(role IN ('owner','admin','manager','employee','read_only')),
      password_hash text, totp_secret_ciphertext bytea, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, email)
    );
    CREATE TABLE organization_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, timezone text NOT NULL DEFAULT 'America/Chicago', address jsonb NOT NULL DEFAULT '{}'::jsonb, active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,name)
    );
    CREATE TABLE phone_numbers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      location_id uuid, e164 text NOT NULL, provider text NOT NULL, purpose text NOT NULL DEFAULT 'receptionist', inbound_enabled boolean NOT NULL DEFAULT true,
      outbound_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,e164)
    );
    CREATE TABLE email_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      employee_id uuid, address text NOT NULL, provider text NOT NULL, inbound_enabled boolean NOT NULL DEFAULT true, outbound_enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,address)
    );
    CREATE TABLE calendars (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      employee_id uuid, location_id uuid, name text NOT NULL, provider text NOT NULL, external_calendar_id text,
      working_hours jsonb NOT NULL DEFAULT '{}'::jsonb, travel_buffer_minutes integer NOT NULL DEFAULT 30, active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,name)
    );
    CREATE TABLE organization_integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      provider text NOT NULL, state text NOT NULL DEFAULT 'disconnected', secret_reference text, settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      connected_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,provider)
    );
    CREATE TABLE digital_employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, role text NOT NULL CHECK(role IN ('receptionist','sales_assistant','ar_clerk','support_technician','purchasing_assistant')),
      owner_user_id uuid, avatar text NOT NULL DEFAULT '🤖', state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','paused','fired')),
      system_prompt text NOT NULL, prompt_version text NOT NULL DEFAULT '1.0.0', capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
      memory_scope jsonb NOT NULL DEFAULT '[]'::jsonb, working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
      escalation_contact text, approval_defaults jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, role)
    );
    CREATE TABLE contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      first_name text NOT NULL, last_name text NOT NULL DEFAULT '', email text, phone text, preferred_channel text NOT NULL DEFAULT 'email',
      customer_tier text NOT NULL DEFAULT 'standard', external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by_employee_id uuid, created_by_task_id uuid, source text NOT NULL, confidence numeric(4,3) NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE properties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), contact_id uuid NOT NULL,
      address_line1 text NOT NULL, city text NOT NULL, region text NOT NULL, postal_code text NOT NULL, property_type text NOT NULL DEFAULT 'residential',
      access_notes text, created_by_employee_id uuid, created_by_task_id uuid, source text NOT NULL, confidence numeric(4,3) NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE equipment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), property_id uuid NOT NULL,
      equipment_type text NOT NULL, manufacturer text, model text, serial_number text, installed_at date, warranty_until date,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE company_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, mime_type text NOT NULL, object_key text NOT NULL, checksum text NOT NULL, uploaded_by_user_id uuid,
      retention_until timestamptz, redacted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE service_catalog (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      sku text NOT NULL, name text NOT NULL, description text NOT NULL DEFAULT '', duration_minutes integer NOT NULL,
      base_price_cents bigint NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,sku)
    );
    CREATE TABLE pipeline_stages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, position integer NOT NULL, terminal boolean NOT NULL DEFAULT false, UNIQUE (organization_id,position)
    );
    CREATE TABLE vendors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, email text, phone text, approved boolean NOT NULL DEFAULT false, terms jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,name)
    );
    CREATE TABLE inventory_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      sku text NOT NULL, name text NOT NULL, quantity numeric(12,3) NOT NULL DEFAULT 0, reorder_point numeric(12,3) NOT NULL DEFAULT 0,
      unit text NOT NULL DEFAULT 'each', preferred_vendor_id uuid, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,sku)
    );
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      contact_id uuid NOT NULL, invoice_number text NOT NULL, amount_cents bigint NOT NULL, balance_cents bigint NOT NULL,
      due_at timestamptz NOT NULL, state text NOT NULL DEFAULT 'open', external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,invoice_number)
    );
    CREATE TABLE support_tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      contact_id uuid NOT NULL, title text NOT NULL, body text NOT NULL, state text NOT NULL DEFAULT 'open', priority text NOT NULL DEFAULT 'normal',
      assigned_employee_id uuid, interaction_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE interactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      channel text NOT NULL CHECK(channel IN ('phone','email','sms','calendar','web_chat','internal')),
      direction text NOT NULL CHECK(direction IN ('inbound','outbound','internal')), status text NOT NULL DEFAULT 'open',
      caller text, participants jsonb NOT NULL DEFAULT '[]'::jsonb, transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
      transcript_retained boolean NOT NULL DEFAULT false, attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
      outcome text, linked_entities jsonb NOT NULL DEFAULT '{}'::jsonb, trace_id uuid NOT NULL DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      title text NOT NULL, description text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','in_progress','waiting_approval','escalated','completed','cancelled')),
      owner_employee_id uuid, assigned_human_id uuid, sla_due_at timestamptz, interaction_id uuid, priority text NOT NULL DEFAULT 'normal',
      workflow_key text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,workflow_key)
    );
    CREATE TABLE handoffs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      from_employee_id uuid NOT NULL, to_employee_id uuid NOT NULL, task_id uuid NOT NULL,
      handoff_type text NOT NULL, goal text NOT NULL, constraints jsonb NOT NULL DEFAULT '{}'::jsonb, deadline timestamptz,
      artifacts jsonb NOT NULL DEFAULT '[]'::jsonb, reason text NOT NULL, accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,task_id,handoff_type)
    );
    CREATE TABLE appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      contact_id uuid NOT NULL, property_id uuid, assigned_employee_id uuid, service_code text NOT NULL, starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','cancelled','completed')),
      calendar_event_id text, created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at > starts_at)
    );
    CREATE UNIQUE INDEX contacts_phone_unique ON contacts(organization_id,phone) WHERE phone IS NOT NULL;
    CREATE UNIQUE INDEX properties_address_unique ON properties(organization_id,address_line1,postal_code);
    CREATE UNIQUE INDEX appointments_calendar_event_unique ON appointments(organization_id,calendar_event_id) WHERE calendar_event_id IS NOT NULL;
    CREATE TABLE deals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), contact_id uuid NOT NULL,
      name text NOT NULL, stage text NOT NULL DEFAULT 'qualified', amount_cents bigint NOT NULL DEFAULT 0, external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,name)
    );
    CREATE TABLE quotes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), deal_id uuid NOT NULL,
      contact_id uuid NOT NULL, task_id uuid, quote_number text NOT NULL, currency char(3) NOT NULL DEFAULT 'USD', amount_cents bigint NOT NULL,
      line_items jsonb NOT NULL, state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','waiting_approval','approved','sent','rejected')),
      approval_decision_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, quote_number)
    );
    CREATE TABLE approval_policies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      name text NOT NULL, version integer NOT NULL DEFAULT 1, matcher jsonb NOT NULL, decision text NOT NULL CHECK(decision IN ('auto_approve','require_approval','deny')),
      approvers jsonb NOT NULL DEFAULT '[]'::jsonb, expires_after interval NOT NULL DEFAULT interval '24 hours', enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, name, version)
    );
    CREATE TABLE approval_decisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      policy_id uuid NOT NULL, action_type text NOT NULL, target_id uuid, decision text NOT NULL CHECK(decision IN ('auto_approved','pending','approved','denied')),
      inputs jsonb NOT NULL, policy_version integer NOT NULL, approver_user_id uuid, reason text, expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, UNIQUE (organization_id,action_type,target_id)
    );
    CREATE TABLE memory_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      kind text NOT NULL, entity_id uuid, scope text NOT NULL, content jsonb NOT NULL, search_text text NOT NULL,
      embedding vector(1536), provenance_employee_id uuid, provenance_task_id uuid, source text NOT NULL,
      confidence numeric(4,3) NOT NULL, redacted_at timestamptz, derived_from uuid[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX memory_items_search_idx ON memory_items USING gin (to_tsvector('english', search_text));
    CREATE UNIQUE INDEX memory_items_provenance_unique ON memory_items(organization_id,kind,entity_id,provenance_task_id) WHERE entity_id IS NOT NULL AND provenance_task_id IS NOT NULL;
    CREATE TABLE workflow_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      workflow_type text NOT NULL, workflow_version text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','waiting_approval','retrying','completed','failed','cancelled')),
      input jsonb NOT NULL, output jsonb NOT NULL DEFAULT '{}'::jsonb, interaction_id uuid, task_id uuid, trace_id uuid NOT NULL DEFAULT gen_random_uuid(),
      next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
      last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE workflow_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), workflow_run_id uuid NOT NULL,
      step_key text NOT NULL, step_order integer NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','waiting_approval','completed','failed','skipped')),
      input jsonb NOT NULL DEFAULT '{}'::jsonb, output jsonb NOT NULL DEFAULT '{}'::jsonb, attempts integer NOT NULL DEFAULT 0,
      idempotency_key text NOT NULL, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text,
      started_at timestamptz, completed_at timestamptz, UNIQUE (organization_id, workflow_run_id, step_key), UNIQUE(organization_id, idempotency_key)
    );
    CREATE INDEX workflow_steps_claim_idx ON workflow_steps (organization_id, next_attempt_at, step_order) WHERE state IN ('pending','failed');
    CREATE TABLE workflow_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id), workflow_run_id uuid NOT NULL,
      step_key text, event_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE outbound_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      interaction_id uuid, task_id uuid, channel text NOT NULL, recipient text NOT NULL, subject text, body text NOT NULL,
      state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sent','failed')), provider_id text, sent_at timestamptz, workflow_key text,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id,workflow_key)
    );
    CREATE TABLE audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(organization_id),
      chain_position bigint GENERATED BY DEFAULT AS IDENTITY,
      actor_type text NOT NULL CHECK(actor_type IN ('employee','human','system')), actor_id uuid, action text NOT NULL, target text NOT NULL,
      inputs_hash text NOT NULL, outputs_hash text NOT NULL, policy_id uuid, approval_id uuid, trace_id uuid NOT NULL,
      details jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(), previous_hash text,
      entry_hash text NOT NULL DEFAULT ''
    );
    CREATE INDEX audit_events_timeline_idx ON audit_events (organization_id, occurred_at DESC);
    CREATE UNIQUE INDEX audit_events_chain_position_unique ON audit_events (organization_id,chain_position);

    CREATE OR REPLACE FUNCTION aios_audit_chain_hash() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE prior text; prior_position bigint;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text, 0));
      SELECT entry_hash, chain_position INTO prior, prior_position FROM audit_events WHERE organization_id = NEW.organization_id ORDER BY chain_position DESC LIMIT 1;
      NEW.chain_position := coalesce(prior_position, 0) + 1;
      NEW.previous_hash := prior;
      NEW.entry_hash := encode(digest(coalesce(prior, '') || '|' || NEW.chain_position::text || '|' || NEW.id::text || '|' || NEW.organization_id::text || '|' ||
        NEW.actor_type || '|' || coalesce(NEW.actor_id::text,'') || '|' || NEW.action || '|' || NEW.target || '|' ||
        NEW.inputs_hash || '|' || NEW.outputs_hash || '|' || coalesce(NEW.policy_id::text,'') || '|' ||
        coalesce(NEW.approval_id::text,'') || '|' || NEW.trace_id::text || '|' || NEW.details::text || '|' || extract(epoch from NEW.occurred_at)::text,
        'sha256'), 'hex');
      RETURN NEW;
    END $$;
    CREATE INDEX audit_events_chain_idx ON audit_events (organization_id,chain_position);
    CREATE OR REPLACE FUNCTION aios_verify_audit_chain(target_org uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT NOT EXISTS (
        SELECT 1 FROM (
          SELECT a.*, lag(entry_hash) OVER (PARTITION BY organization_id ORDER BY chain_position) AS expected_previous
          FROM audit_events a WHERE organization_id = target_org
        ) chain
        WHERE previous_hash IS DISTINCT FROM expected_previous
          OR entry_hash IS DISTINCT FROM encode(digest(coalesce(previous_hash, '') || '|' || chain_position::text || '|' || id::text || '|' || organization_id::text || '|' ||
            actor_type || '|' || coalesce(actor_id::text,'') || '|' || action || '|' || target || '|' || inputs_hash || '|' || outputs_hash || '|' ||
            coalesce(policy_id::text,'') || '|' || coalesce(approval_id::text,'') || '|' || trace_id::text || '|' || details::text || '|' || extract(epoch from occurred_at)::text,
            'sha256'), 'hex')
      )
    $$;
    CREATE TRIGGER audit_chain_before_insert BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION aios_audit_chain_hash();
    CREATE OR REPLACE FUNCTION aios_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = '55000'; END $$;
    CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION aios_reject_audit_mutation();

    DO $$ DECLARE t text; BEGIN
      FOREACH t IN ARRAY ARRAY['organizations','human_users','organization_locations','phone_numbers','email_accounts','calendars','organization_integrations','digital_employees','contacts','properties','equipment','company_documents','service_catalog','pipeline_stages','vendors','inventory_items','invoices','support_tickets','interactions','tasks','handoffs','appointments','deals','quotes','approval_policies','approval_decisions','memory_items','workflow_runs','workflow_steps','workflow_events','outbound_messages','audit_events'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t);
      END LOOP;
    END $$;
    GRANT USAGE ON SCHEMA public TO aios;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aios;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aios;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aios;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO aios;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS audit_events, outbound_messages, workflow_events, workflow_steps, workflow_runs, memory_items, approval_decisions, approval_policies, quotes, deals, appointments, handoffs, tasks, interactions, support_tickets, invoices, inventory_items, vendors, pipeline_stages, service_catalog, company_documents, equipment, properties, contacts, digital_employees, organization_integrations, calendars, email_accounts, phone_numbers, organization_locations, human_users, organizations CASCADE; DROP FUNCTION IF EXISTS aios_audit_chain_hash(); DROP FUNCTION IF EXISTS aios_reject_audit_mutation(); DROP FUNCTION IF EXISTS aios_verify_audit_chain(uuid);`);
};
