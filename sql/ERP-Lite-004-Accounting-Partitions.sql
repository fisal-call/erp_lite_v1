-- =========================================================
-- ERP LITE — PART 4 of 4 (FINAL)
-- Schema: accounting · reporting (placeholder)
-- Partition bootstrap for all partitioned tables.
-- Depends on: ERP-Lite-001, ERP-Lite-002, ERP-Lite-003
-- No Budget/FixedAsset/CostCenter dimension (deferred to Enterprise tier) —
-- JournalEntryLine.cost_center_id kept nullable+FK-ready is intentionally
-- OMITTED here for Lite; can be added later as a pure ADD COLUMN (no redesign).
-- =========================================================

CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SCHEMA IF NOT EXISTS reporting;

COMMENT ON SCHEMA accounting IS 'ERP Lite: Chart of Accounts, Journal, General Ledger, Cash & Bank. Budget/FixedAsset deferred to Enterprise tier.';
COMMENT ON SCHEMA reporting  IS 'Read-only layer. Views/materialized views added as reports are built; no source tables live here (ERP-004 §1).';

-- =========================================================
-- SCHEMA: accounting
-- =========================================================

-- Chart of Accounts — self-referencing hierarchy (Group vs Detail accounts).
CREATE TABLE accounting.account (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    account_code        VARCHAR(30) NOT NULL,
    account_name        VARCHAR(200) NOT NULL,
    account_type        VARCHAR(20) NOT NULL,   -- asset/liability/equity/revenue/expense
    parent_account_id   BIGINT,
    is_group            BOOLEAN NOT NULL DEFAULT false,   -- BR-ACC-006: postings only allowed when false
    is_active            BOOLEAN NOT NULL DEFAULT true,
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    version_no             INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_account__uuid UNIQUE (uuid),
    CONSTRAINT uq_account__company_code UNIQUE (company_id, account_code),
    CONSTRAINT fk_account__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_account__parent FOREIGN KEY (parent_account_id) REFERENCES accounting.account (id),
    CONSTRAINT ck_account__type CHECK (account_type IN ('asset','liability','equity','revenue','expense'))
);
CREATE INDEX ix_account__company ON accounting.account (company_id) WHERE is_deleted = false;

CREATE TABLE accounting.journal_entry (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    posting_date        DATE NOT NULL,
    fiscal_year_id      BIGINT NOT NULL,
    source_doctype      VARCHAR(100),          -- polymorphic source (e.g. SalesInvoice) — no FK, Service Layer verified
    source_uuid         UUID,
    narration           VARCHAR(500),
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',   -- 'submitted' == posted/immutable (BR-ACC-001)
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    CONSTRAINT uq_journal_entry__uuid UNIQUE (uuid),
    CONSTRAINT uq_journal_entry__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_journal_entry__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_journal_entry__fiscal_year FOREIGN KEY (fiscal_year_id) REFERENCES core.fiscal_year (id),
    CONSTRAINT ck_journal_entry__status CHECK (status IN ('draft','submitted','cancelled'))
);
COMMENT ON TABLE accounting.journal_entry IS
    'BR-ACC-001: once status = submitted, no UPDATE is permitted from the application role '
    '(enforced via database privileges in the security hardening pass) — corrections are reversal entries only.';
CREATE INDEX ix_journal_entry__company_status ON accounting.journal_entry (company_id, status);

CREATE TABLE accounting.journal_entry_line (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_entry_id    BIGINT NOT NULL,
    account_id          BIGINT NOT NULL,
    debit_amount        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount       NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    version_no          INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_journal_entry_line__entry FOREIGN KEY (journal_entry_id) REFERENCES accounting.journal_entry (id),
    CONSTRAINT fk_journal_entry_line__account FOREIGN KEY (account_id) REFERENCES accounting.account (id),
    CONSTRAINT ck_journal_entry_line__one_sided CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)
    )
);
CREATE INDEX ix_journal_entry_line__account ON accounting.journal_entry_line (account_id);
COMMENT ON TABLE accounting.journal_entry_line IS
    'BR-ACC-003: sum(debit) must equal sum(credit) per journal_entry — enforced in Service Layer '
    'before allowing status transition to submitted (not a DB CHECK, since it spans multiple rows).';

-- GeneralLedgerEntry: single ledger per company (BD-006), monthly-partitioned, append-only.
CREATE TABLE accounting.general_ledger_entry (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,          -- dimension only (BD-006) — not a separate ledger
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    account_id          BIGINT NOT NULL,
    fiscal_period_id    BIGINT NOT NULL,
    debit_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
    transaction_currency VARCHAR(3) NOT NULL,
    reporting_currency    VARCHAR(3) NOT NULL,
    exchange_rate         NUMERIC(18,8) NOT NULL DEFAULT 1,
    source_doctype       VARCHAR(100) NOT NULL,
    source_uuid          UUID NOT NULL,
    posting_date         DATE NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, posting_date)
) PARTITION BY RANGE (posting_date);
COMMENT ON TABLE accounting.general_ledger_entry IS 'Single GL per company (BD-006). Append-only, monthly partitioned.';
CREATE INDEX ix_general_ledger_entry__company_account_period ON accounting.general_ledger_entry (company_id, account_id, fiscal_period_id);

CREATE TABLE accounting.cash_account (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    branch_id       BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    account_name    VARCHAR(150) NOT NULL,
    gl_account_id   BIGINT NOT NULL,
    currency_id     BIGINT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_cash_account__uuid UNIQUE (uuid),
    CONSTRAINT fk_cash_account__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_cash_account__gl_account FOREIGN KEY (gl_account_id) REFERENCES accounting.account (id),
    CONSTRAINT fk_cash_account__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id)
);

CREATE TABLE accounting.bank (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID NOT NULL DEFAULT gen_random_uuid(),
    bank_name   VARCHAR(150) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_bank__uuid UNIQUE (uuid)
);

CREATE TABLE accounting.bank_account (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                    UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id              BIGINT NOT NULL,
    branch_id               BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    bank_id                 BIGINT NOT NULL,
    account_number_masked   VARCHAR(50) NOT NULL,   -- full number encrypted at application layer (§13.4)
    gl_account_id           BIGINT NOT NULL,
    currency_id             BIGINT NOT NULL,
    is_active                BOOLEAN NOT NULL DEFAULT true,
    is_deleted                BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_bank_account__uuid UNIQUE (uuid),
    CONSTRAINT fk_bank_account__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_bank_account__bank FOREIGN KEY (bank_id) REFERENCES accounting.bank (id),
    CONSTRAINT fk_bank_account__gl_account FOREIGN KEY (gl_account_id) REFERENCES accounting.account (id),
    CONSTRAINT fk_bank_account__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id)
);

CREATE TABLE accounting.cheque (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    bank_account_id     BIGINT NOT NULL,
    cheque_number       VARCHAR(50) NOT NULL,
    direction            VARCHAR(10) NOT NULL,   -- 'incoming'/'outgoing'
    amount                NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    cheque_date           DATE NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/cleared/bounced/cancelled
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             BIGINT,
    version_no              INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_cheque__uuid UNIQUE (uuid),
    CONSTRAINT fk_cheque__bank_account FOREIGN KEY (bank_account_id) REFERENCES accounting.bank_account (id),
    CONSTRAINT ck_cheque__direction CHECK (direction IN ('incoming','outgoing')),
    CONSTRAINT ck_cheque__status CHECK (status IN ('pending','cleared','bounced','cancelled'))
);
CREATE INDEX ix_cheque__bank_account ON accounting.cheque (bank_account_id, status);

-- =========================================================
-- PARTITION BOOTSTRAP (lesson from ERP-005R REV5-015: never leave a partitioned
-- table without child partitions + a DEFAULT safety net).
-- Creates 24 months forward from the current month for every partitioned table.
-- A recurring background job must create each new month ahead of time going forward.
-- =========================================================
DO $$
DECLARE
    start_month DATE := date_trunc('month', now())::date;
    i INTEGER;
    part_start DATE;
    part_end   DATE;
BEGIN
    FOR i IN 0..23 LOOP
        part_start := (start_month + (i || ' months')::interval)::date;
        part_end   := (start_month + ((i+1) || ' months')::interval)::date;

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS system.%I PARTITION OF system.notification FOR VALUES FROM (%L) TO (%L);',
            'notification_' || to_char(part_start, 'YYYY_MM'), part_start, part_end
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS inventory.%I PARTITION OF inventory.stock_ledger_entry FOR VALUES FROM (%L) TO (%L);',
            'stock_ledger_entry_' || to_char(part_start, 'YYYY_MM'), part_start, part_end
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS accounting.%I PARTITION OF accounting.general_ledger_entry FOR VALUES FROM (%L) TO (%L);',
            'general_ledger_entry_' || to_char(part_start, 'YYYY_MM'), part_start, part_end
        );
    END LOOP;

    EXECUTE 'CREATE TABLE IF NOT EXISTS system.notification_default PARTITION OF system.notification DEFAULT;';
    EXECUTE 'CREATE TABLE IF NOT EXISTS inventory.stock_ledger_entry_default PARTITION OF inventory.stock_ledger_entry DEFAULT;';
    EXECUTE 'CREATE TABLE IF NOT EXISTS accounting.general_ledger_entry_default PARTITION OF accounting.general_ledger_entry DEFAULT;';
END $$;
