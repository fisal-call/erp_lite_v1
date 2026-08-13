-- =========================================================
-- ERP LITE — PART 8 — Cost Centers (v1.0 Finalization)
--
-- Scope: master data only — list, create, edit, view, active/inactive.
-- No FK links from existing transactional tables (journal_entry_line etc.)
-- in this phase. Linking transactions to cost centers is deferred to v2
-- (would require schema changes to large tables and service-layer updates
-- across multiple modules — out of scope for v1.0 per the FINALIZATION brief).
--
-- Design choices:
--   * Schema: `core` (master-data, company-scoped, like payment_term).
--   * Hierarchical via `parent_cost_center_id` (self-FK, nullable).
--   * Standard audit columns (created_at/by, updated_at/by, is_deleted,
--     version_no for optimistic locking — same pattern as customer/supplier).
--   * RLS-enabled (FORCE ROW LEVEL SECURITY, scoped by company_id).
--   * Unique by (company_id, cost_center_code).
-- =========================================================

CREATE TABLE IF NOT EXISTS core.cost_center (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    company_id      bigint NOT NULL REFERENCES core.company(id),
    tenant_id       bigint NOT NULL DEFAULT 1,
    cost_center_code   character varying(50) NOT NULL,
    cost_center_name   character varying(200) NOT NULL,
    parent_cost_center_id bigint,  -- self-FK added below (after table creation)
    is_active       boolean NOT NULL DEFAULT true,
    is_deleted      boolean NOT NULL DEFAULT false,
    version_no      integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      bigint,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      bigint,
    deleted_at      timestamptz,
    deleted_by      bigint,
    CONSTRAINT uq_cost_center__company_code UNIQUE (company_id, cost_center_code),
    CONSTRAINT ck_cost_center__code_nonempty CHECK (char_length(trim(cost_center_code)) > 0)
);

-- Self-FK for hierarchy (added separately so it can be NULL on first row)
ALTER TABLE core.cost_center
    ADD CONSTRAINT fk_cost_center__parent
    FOREIGN KEY (parent_cost_center_id) REFERENCES core.cost_center(id);

-- Index for the common "list all cost centers for my company" query
CREATE INDEX IF NOT EXISTS ix_cost_center__company_active
    ON core.cost_center (company_id) WHERE is_deleted = false;

-- RLS (Row-Level Security) — same pattern as customer/supplier/payment_term
ALTER TABLE core.cost_center ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cost_center FORCE ROW LEVEL SECURITY;

-- Policy: a row is visible iff its company_id is in the session's company_ids list.
CREATE POLICY p_cost_center__company_isolation ON core.cost_center
    USING (company_id = ANY(string_to_array(current_setting('app.current_company_ids', true), ',')::bigint[]));

-- Grant access to application roles
GRANT SELECT, INSERT, UPDATE ON core.cost_center TO erplite_app_role;
GRANT SELECT ON core.cost_center TO erplite_readonly_role;
GRANT SELECT, INSERT, UPDATE ON core.cost_center TO erplite_bootstrap_role;
GRANT USAGE, SELECT ON SEQUENCE core.cost_center_id_seq TO erplite_app_role, erplite_bootstrap_role;

COMMENT ON TABLE core.cost_center IS
    'Cost centers master data — v1.0 minimal: list/create/edit/view/active-toggle. '
    'Hierarchical via parent_cost_center_id (self-FK). RLS-enforced (company-scoped). '
    'Linking to transactions (journal_entry_line.cost_center_id etc.) is deferred to v2.';

COMMENT ON COLUMN core.cost_center.cost_center_code IS 'Stable external identifier (not editable post-creation, like customer_code/item_code).';
COMMENT ON COLUMN core.cost_center.parent_cost_center_id IS 'Optional self-FK for hierarchy. NULL = top-level cost center.';
