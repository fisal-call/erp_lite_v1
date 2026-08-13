-- =========================================================
-- ERP LITE — PART 1 of 4
-- Schemas: system · security · core
-- Scope: Small/Medium trading business. Same architecture, naming
-- conventions, and standards as the Enterprise design — Enterprise-only
-- modules (Workflow Engine, Approval Matrix, Manufacturing, HR, CRM,
-- Fixed Assets, Projects, Budgeting, BI, Integration/eInvoice) excluded.
-- Every table remains extensible (custom_fields, uuid, tenant_id) so
-- Enterprise modules can be layered on later without redesigning
-- existing tables.
-- Target: PostgreSQL 15+
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS core;

COMMENT ON SCHEMA system   IS 'ERP Lite: Metadata Engine (kept minimal for extensibility), document numbering, notifications, migration history.';
COMMENT ON SCHEMA security IS 'ERP Lite: Identity, roles, basic permissions. No delegation/API-credential tables (deferred to Enterprise tier).';
COMMENT ON SCHEMA core     IS 'ERP Lite: Company/Branch, currency, tax, unit of measure, address. Department/CostCenter/Project deferred to Enterprise tier.';

-- =========================================================
-- SCHEMA: system
-- =========================================================

CREATE TABLE system.schema_migration_history (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    migration_name  VARCHAR(200) NOT NULL,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_by      VARCHAR(100) NOT NULL,
    CONSTRAINT uq_schema_migration_history__migration_name UNIQUE (migration_name)
);

-- AD-008: sole authority for global UUID uniqueness (kept — cheap, foundational, enables safe
-- future addition of Enterprise Polymorphic References without redesign).
CREATE TABLE system.global_entity_registry (
    entity_uuid     UUID PRIMARY KEY,
    doctype_name    VARCHAR(100) NOT NULL,
    schema_name     VARCHAR(63)  NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE system.global_entity_registry IS
    'AD-008: sole authority for global UUID uniqueness. Service Layer inserts a row here in the '
    'same transaction as creating any row with a uuid, before any PolymorphicReference to it.';
CREATE INDEX ix_global_entity_registry__doctype_name ON system.global_entity_registry (doctype_name);

-- Metadata Engine kept minimal (DocType/DocField only — translation tables deferred to Enterprise
-- tier) so custom fields and future modules remain possible without table redesign (ERP-001 §4).
CREATE TABLE system.doc_type (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    doctype_name    VARCHAR(100) NOT NULL,
    schema_name     VARCHAR(63)  NOT NULL,
    table_name      VARCHAR(63)  NOT NULL,
    module_name     VARCHAR(100) NOT NULL,
    is_submittable  BOOLEAN NOT NULL DEFAULT false,
    version_no      INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_doc_type__uuid UNIQUE (uuid),
    CONSTRAINT uq_doc_type__doctype_name UNIQUE (doctype_name)
);

CREATE TABLE system.doc_field (
    id                                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                               UUID NOT NULL DEFAULT gen_random_uuid(),
    doc_type_id                        BIGINT NOT NULL,
    field_name                         VARCHAR(100) NOT NULL,
    field_type                         VARCHAR(30) NOT NULL,
    is_core_field                      BOOLEAN NOT NULL DEFAULT false,
    is_mandatory                       BOOLEAN NOT NULL DEFAULT false,
    default_value                      TEXT,
    field_level_permission_default     VARCHAR(20) NOT NULL DEFAULT 'public',
    extra_metadata                     JSONB,
    version_no                         INTEGER NOT NULL DEFAULT 1,
    is_deleted                         BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_doc_field__uuid UNIQUE (uuid),
    CONSTRAINT uq_doc_field__doctype_field UNIQUE (doc_type_id, field_name),
    CONSTRAINT fk_doc_field__doc_type FOREIGN KEY (doc_type_id) REFERENCES system.doc_type (id)
);

-- PDR-008: document numbering, separate from internal id/uuid.
CREATE TABLE system.document_number_counter (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id          BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    doctype_name        VARCHAR(100) NOT NULL,
    fiscal_year_id      BIGINT,
    prefix              VARCHAR(20) NOT NULL DEFAULT '',
    last_number         BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    -- NOTE: uniqueness on (company_id, doctype_name, fiscal_year_id) is NOT declared as a
    -- table CONSTRAINT here — a plain UNIQUE constraint would silently allow duplicate rows
    -- whenever fiscal_year_id IS NULL (continuous-numbering scope), because SQL treats NULL
    -- <> NULL for uniqueness purposes. This was caught via an actual 20-way concurrency test
    -- (Phase 2 validation) that produced duplicate document numbers. Fixed below with a
    -- COALESCE-based unique INDEX instead, which collapses all NULL fiscal_year_id rows for
    -- the same (company, doctype) into a single enforced-unique row.
);
CREATE UNIQUE INDEX uq_document_number_counter__scope
    ON system.document_number_counter (company_id, doctype_name, COALESCE(fiscal_year_id, -1));
COMMENT ON TABLE system.document_number_counter IS
    'Every read-modify-write of last_number MUST occur inside a single transaction using '
    'SELECT ... FOR UPDATE from the Service Layer to prevent race conditions under concurrent load.';

-- Notification: monthly-partitioned, default partition included (lesson from ERP-005R REV5-015).
CREATE TABLE system.notification (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    recipient_user_id BIGINT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    source_doctype  VARCHAR(100),
    source_uuid     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_notification__recipient ON system.notification (recipient_user_id, is_read);

CREATE TABLE system.attachment (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    source_doctype      VARCHAR(100) NOT NULL,
    source_uuid         UUID NOT NULL,
    storage_provider    VARCHAR(30) NOT NULL,
    storage_path        TEXT NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(150),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_attachment__uuid UNIQUE (uuid)
);
CREATE INDEX ix_attachment__source ON system.attachment (source_uuid);

-- =========================================================
-- SCHEMA: security
-- =========================================================

-- AD-009: "user" collides with SQL reserved word -> app_user.
CREATE TABLE security.app_user (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    version_no      INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT,
    deleted_at      TIMESTAMPTZ,
    deleted_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    custom_fields   JSONB,
    -- BD-010: username/email permanently reserved after soft delete (no reuse) — audit integrity.
    CONSTRAINT uq_app_user__uuid UNIQUE (uuid),
    CONSTRAINT uq_app_user__username UNIQUE (username),
    CONSTRAINT uq_app_user__email UNIQUE (email)
);
CREATE INDEX ix_app_user__is_deleted ON security.app_user (is_deleted) WHERE is_deleted = false;

CREATE TABLE security.role (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    role_name       VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_role__uuid UNIQUE (uuid),
    CONSTRAINT uq_role__role_name UNIQUE (role_name)
);

CREATE TABLE security.user_role_assignment (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    role_id     BIGINT NOT NULL,
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_role_assignment__user_role UNIQUE (user_id, role_id),
    CONSTRAINT fk_user_role_assignment__user FOREIGN KEY (user_id) REFERENCES security.app_user (id),
    CONSTRAINT fk_user_role_assignment__role FOREIGN KEY (role_id) REFERENCES security.role (id)
);

-- Basic DocType/Row-level permissions (no field-level granularity needed for Lite; field is
-- nullable and available for future Enterprise upgrade without redesign).
CREATE TABLE security.permission_rule (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    role_id             BIGINT NOT NULL,
    doc_type_id         BIGINT NOT NULL,
    can_read            BOOLEAN NOT NULL DEFAULT true,
    can_create          BOOLEAN NOT NULL DEFAULT false,
    can_update          BOOLEAN NOT NULL DEFAULT false,
    can_delete          BOOLEAN NOT NULL DEFAULT false,
    can_submit          BOOLEAN NOT NULL DEFAULT false,
    row_level_condition JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_permission_rule__uuid UNIQUE (uuid),
    CONSTRAINT fk_permission_rule__role FOREIGN KEY (role_id) REFERENCES security.role (id),
    CONSTRAINT fk_permission_rule__doc_type FOREIGN KEY (doc_type_id) REFERENCES system.doc_type (id)
);
CREATE INDEX ix_permission_rule__role_doctype ON security.permission_rule (role_id, doc_type_id) WHERE is_active = true;

CREATE TABLE security.user_company_access (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    company_id  BIGINT NOT NULL,
    branch_id   BIGINT,
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_company_access__scope UNIQUE (user_id, company_id, branch_id),
    CONSTRAINT fk_user_company_access__user FOREIGN KEY (user_id) REFERENCES security.app_user (id)
);

-- =========================================================
-- SCHEMA: core
-- =========================================================

CREATE TABLE core.country (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID NOT NULL DEFAULT gen_random_uuid(),
    iso_code    VARCHAR(3) NOT NULL,
    name_ar     VARCHAR(150) NOT NULL,
    name_en     VARCHAR(150) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_country__uuid UNIQUE (uuid),
    CONSTRAINT uq_country__iso_code UNIQUE (iso_code)
);

CREATE TABLE core.city (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID NOT NULL DEFAULT gen_random_uuid(),
    country_id  BIGINT NOT NULL,
    name_ar     VARCHAR(150) NOT NULL,
    name_en     VARCHAR(150) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_city__uuid UNIQUE (uuid),
    CONSTRAINT fk_city__country FOREIGN KEY (country_id) REFERENCES core.country (id)
);
CREATE INDEX ix_city__country_id ON core.city (country_id);

CREATE TABLE core.currency (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    iso_code        VARCHAR(3) NOT NULL,
    name_ar         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100) NOT NULL,
    symbol          VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_currency__uuid UNIQUE (uuid),
    CONSTRAINT uq_currency__iso_code UNIQUE (iso_code)
);

CREATE TABLE core.exchange_rate (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_currency_id    BIGINT NOT NULL,
    to_currency_id      BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    rate_date           DATE NOT NULL,
    rate                NUMERIC(18,8) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_exchange_rate__scope UNIQUE (from_currency_id, to_currency_id, rate_date),
    CONSTRAINT fk_exchange_rate__from FOREIGN KEY (from_currency_id) REFERENCES core.currency (id),
    CONSTRAINT fk_exchange_rate__to   FOREIGN KEY (to_currency_id)   REFERENCES core.currency (id),
    CONSTRAINT ck_exchange_rate__positive CHECK (rate > 0)
);

CREATE TABLE core.unit_of_measure (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    uom_name        VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_unit_of_measure__uuid UNIQUE (uuid),
    CONSTRAINT uq_unit_of_measure__name UNIQUE (uom_name)
);

CREATE TABLE core.uom_conversion (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_uom_id         BIGINT NOT NULL,
    to_uom_id           BIGINT NOT NULL,
    conversion_factor   NUMERIC(18,6) NOT NULL,
    CONSTRAINT uq_uom_conversion__pair UNIQUE (from_uom_id, to_uom_id),
    CONSTRAINT fk_uom_conversion__from FOREIGN KEY (from_uom_id) REFERENCES core.unit_of_measure (id),
    CONSTRAINT fk_uom_conversion__to   FOREIGN KEY (to_uom_id)   REFERENCES core.unit_of_measure (id)
);

-- Taxes module (requested) — kept generic/country-neutral (no ETA/eInvoice-specific mapping;
-- that stays deferred to the Enterprise Integration Layer, per AD-002 boundary).
CREATE TABLE core.tax_rate (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    tax_name        VARCHAR(100) NOT NULL,
    tax_percent     NUMERIC(7,4) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_tax_rate__uuid UNIQUE (uuid),
    CONSTRAINT ck_tax_rate__percent_range CHECK (tax_percent >= 0 AND tax_percent <= 100)
);

CREATE TABLE core.company (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                        UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                   BIGINT NOT NULL DEFAULT 1,
    company_name                VARCHAR(200) NOT NULL,
    base_currency_id            BIGINT NOT NULL,
    country_id                  BIGINT NOT NULL,
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'Africa/Cairo',
    inventory_valuation_method  VARCHAR(20) NOT NULL DEFAULT 'weighted_average',
    version_no                  INTEGER NOT NULL DEFAULT 1,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                  BIGINT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by                  BIGINT,
    deleted_at                  TIMESTAMPTZ,
    deleted_by                  BIGINT,
    is_deleted                  BOOLEAN NOT NULL DEFAULT false,
    custom_fields                JSONB,
    CONSTRAINT uq_company__uuid UNIQUE (uuid),
    CONSTRAINT fk_company__base_currency FOREIGN KEY (base_currency_id) REFERENCES core.currency (id),
    CONSTRAINT fk_company__country FOREIGN KEY (country_id) REFERENCES core.country (id),
    CONSTRAINT ck_company__valuation_method CHECK (inventory_valuation_method IN ('weighted_average','fifo'))
);
CREATE INDEX ix_company__is_deleted ON core.company (is_deleted) WHERE is_deleted = false;

ALTER TABLE security.user_company_access
    ADD CONSTRAINT fk_user_company_access__company FOREIGN KEY (company_id) REFERENCES core.company (id);
ALTER TABLE core.tax_rate
    ADD CONSTRAINT fk_tax_rate__company FOREIGN KEY (company_id) REFERENCES core.company (id);

CREATE TABLE core.branch (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    branch_name     VARCHAR(200) NOT NULL,
    version_no      INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    custom_fields   JSONB,
    CONSTRAINT uq_branch__uuid UNIQUE (uuid),
    CONSTRAINT uq_branch__id_company UNIQUE (id, company_id),
    CONSTRAINT fk_branch__company FOREIGN KEY (company_id) REFERENCES core.company (id)
);
CREATE INDEX ix_branch__company_id ON core.branch (company_id) WHERE is_deleted = false;

-- FIX (Phase 1 implementation validation): fiscal_year/fiscal_period were referenced by
-- accounting.journal_entry / accounting.general_ledger_entry but never created in this file —
-- confirmed missing via actual psql execution. Added here to unblock Part 4. Required for
-- BR-ACC-002 (no posting into a closed period) and BD-006 (single ledger per company).
CREATE TABLE core.fiscal_year (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    year_label      VARCHAR(20) NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_closed       BOOLEAN NOT NULL DEFAULT false,
    closed_at       TIMESTAMPTZ,
    closed_by       BIGINT,
    CONSTRAINT uq_fiscal_year__uuid UNIQUE (uuid),
    CONSTRAINT uq_fiscal_year__company_label UNIQUE (company_id, year_label),
    CONSTRAINT fk_fiscal_year__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT ck_fiscal_year__date_range CHECK (end_date > start_date)
);
CREATE INDEX ix_fiscal_year__company_id ON core.fiscal_year (company_id);

CREATE TABLE core.fiscal_period (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fiscal_year_id  BIGINT NOT NULL,
    period_number   SMALLINT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_closed       BOOLEAN NOT NULL DEFAULT false,   -- BR-ACC-002 enforcement point
    closed_at       TIMESTAMPTZ,
    closed_by       BIGINT,
    CONSTRAINT uq_fiscal_period__year_number UNIQUE (fiscal_year_id, period_number),
    CONSTRAINT fk_fiscal_period__fiscal_year FOREIGN KEY (fiscal_year_id) REFERENCES core.fiscal_year (id),
    CONSTRAINT ck_fiscal_period__date_range CHECK (end_date > start_date)
);
CREATE INDEX ix_fiscal_period__closed ON core.fiscal_period (fiscal_year_id, is_closed);

CREATE TABLE core.address (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_uuid      UUID NOT NULL,      -- polymorphic (Company/Branch/Customer/Supplier) — no FK, per AD-008 pattern
    address_type    VARCHAR(20) NOT NULL DEFAULT 'billing',
    line1           VARCHAR(255) NOT NULL,
    line2           VARCHAR(255),
    city_id         BIGINT,
    country_id      BIGINT NOT NULL,
    postal_code     VARCHAR(20),
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT fk_address__city FOREIGN KEY (city_id) REFERENCES core.city (id),
    CONSTRAINT fk_address__country FOREIGN KEY (country_id) REFERENCES core.country (id)
);
CREATE INDEX ix_address__owner_uuid ON core.address (owner_uuid);

CREATE TABLE core.payment_term (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    term_name       VARCHAR(100) NOT NULL,
    days_due        SMALLINT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_payment_term__uuid UNIQUE (uuid),
    CONSTRAINT fk_payment_term__company FOREIGN KEY (company_id) REFERENCES core.company (id)
);
