-- Migration: 20260629000000_initial_schema.sql
-- PURE Collections — baseline cloud schema
-- Applied manually to the Supabase project (rlkanhhisiftqgdeugvb) on 2026-06-29.
--
-- All CREATE statements use IF NOT EXISTS / OR REPLACE so this migration is
-- safe to apply on a database that already has this schema in place.
-- Principle: additive only — this file never drops data or columns.

-- ── Custom types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'manager', 'clerk');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  slug           text        NOT NULL UNIQUE,
  tier           text        NOT NULL DEFAULT 'internal',
  features       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  outgoing_email text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  full_name    text        NOT NULL DEFAULT '',
  role         user_role   NOT NULL DEFAULT 'clerk',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS rivhit_credentials (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  vault_secret_id uuid        NOT NULL,
  token_hint      text        NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_statuses (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_status_key        text        NOT NULL,
  status                text        NOT NULL,
  expected_payment_date date,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid        REFERENCES users(id),
  UNIQUE (tenant_id, doc_status_key)
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name  text        NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  notes          text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid        REFERENCES users(id),
  UNIQUE (tenant_id, customer_name)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name  text        NOT NULL,
  doc_status_key text,
  activity_type  text        NOT NULL,
  text           text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sync_type      text        NOT NULL,
  document_count integer     NOT NULL,
  previous_count integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES users(id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ds_tenant   ON document_statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ds_key      ON document_statuses(tenant_id, doc_status_key);
CREATE INDEX IF NOT EXISTS idx_cc_tenant   ON customer_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cc_name     ON customer_contacts(tenant_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_al_tenant   ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_al_customer ON activity_log(tenant_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_al_doc_key  ON activity_log(tenant_id, doc_status_key)
  WHERE doc_status_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_created  ON activity_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sl_tenant   ON sync_log(tenant_id, created_at DESC);

-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivhit_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_statuses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log           ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS before each CREATE ensures this migration is idempotent.

-- tenants
DROP POLICY IF EXISTS "tenants: read own" ON tenants;
CREATE POLICY "tenants: read own"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id());

-- users
DROP POLICY IF EXISTS "users: read own tenant"    ON users;
DROP POLICY IF EXISTS "users: insert owner only"  ON users;
DROP POLICY IF EXISTS "users: update owner only"  ON users;
DROP POLICY IF EXISTS "users: delete owner only"  ON users;

CREATE POLICY "users: read own tenant"
  ON users FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "users: insert owner only"
  ON users FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_user_role() = 'owner'
  );

CREATE POLICY "users: update owner only"
  ON users FOR UPDATE
  USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() = 'owner'
  );

CREATE POLICY "users: delete owner only"
  ON users FOR DELETE
  USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() = 'owner'
  );

-- rivhit_credentials
DROP POLICY IF EXISTS "rivhit_credentials: owner only" ON rivhit_credentials;

CREATE POLICY "rivhit_credentials: owner only"
  ON rivhit_credentials FOR ALL
  USING (
    tenant_id = auth_tenant_id() AND
    auth_user_role() = 'owner'
  )
  WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_user_role() = 'owner'
  );

-- document_statuses
DROP POLICY IF EXISTS "document_statuses: read own tenant"   ON document_statuses;
DROP POLICY IF EXISTS "document_statuses: insert own tenant" ON document_statuses;
DROP POLICY IF EXISTS "document_statuses: update own tenant" ON document_statuses;

CREATE POLICY "document_statuses: read own tenant"
  ON document_statuses FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "document_statuses: insert own tenant"
  ON document_statuses FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "document_statuses: update own tenant"
  ON document_statuses FOR UPDATE
  USING (tenant_id = auth_tenant_id());

-- customer_contacts
DROP POLICY IF EXISTS "customer_contacts: read own tenant"   ON customer_contacts;
DROP POLICY IF EXISTS "customer_contacts: insert own tenant" ON customer_contacts;
DROP POLICY IF EXISTS "customer_contacts: update own tenant" ON customer_contacts;

CREATE POLICY "customer_contacts: read own tenant"
  ON customer_contacts FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "customer_contacts: insert own tenant"
  ON customer_contacts FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "customer_contacts: update own tenant"
  ON customer_contacts FOR UPDATE
  USING (tenant_id = auth_tenant_id());

-- activity_log (append-only — no UPDATE or DELETE policy)
DROP POLICY IF EXISTS "activity_log: read own tenant"   ON activity_log;
DROP POLICY IF EXISTS "activity_log: insert own tenant" ON activity_log;

CREATE POLICY "activity_log: read own tenant"
  ON activity_log FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "activity_log: insert own tenant"
  ON activity_log FOR INSERT
  WITH CHECK (
    tenant_id  = auth_tenant_id() AND
    created_by = auth.uid()
  );

-- sync_log (append-only — no UPDATE or DELETE policy)
DROP POLICY IF EXISTS "sync_log: read own tenant"   ON sync_log;
DROP POLICY IF EXISTS "sync_log: insert own tenant" ON sync_log;

CREATE POLICY "sync_log: read own tenant"
  ON sync_log FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "sync_log: insert own tenant"
  ON sync_log FOR INSERT
  WITH CHECK (
    tenant_id  = auth_tenant_id() AND
    created_by = auth.uid()
  );

-- ── Vault functions ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_rivhit_token(
  p_tenant_id uuid,
  p_token     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_name text;
  v_hint        text;
  v_secret_id   uuid;
  v_existing_id uuid;
BEGIN
  v_hint        := '···' || right(p_token, 4);
  v_secret_name := 'rivhit_token_' || p_tenant_id::text;

  SELECT id INTO v_existing_id
  FROM vault.secrets
  WHERE name = v_secret_name
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_id, p_token);
    v_secret_id := v_existing_id;
  ELSE
    v_secret_id := vault.create_secret(p_token, v_secret_name, 'Rivhit API token');
  END IF;

  INSERT INTO rivhit_credentials (tenant_id, vault_secret_id, token_hint, updated_at)
  VALUES (p_tenant_id, v_secret_id, v_hint, now())
  ON CONFLICT (tenant_id) DO UPDATE SET
    vault_secret_id = EXCLUDED.vault_secret_id,
    token_hint      = EXCLUDED.token_hint,
    updated_at      = now();
END;
$$;

CREATE OR REPLACE FUNCTION get_rivhit_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_token     text;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM rivhit_credentials
  WHERE tenant_id = p_tenant_id;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION upsert_rivhit_token FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_rivhit_token    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION upsert_rivhit_token TO service_role;
GRANT  EXECUTE ON FUNCTION get_rivhit_token    TO service_role;
