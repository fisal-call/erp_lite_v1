-- =========================================================
-- ERP LITE — PART 2 of 4
-- Schema: inventory
-- Depends on: ERP-Lite-001-System-Security-Core.sql
-- =========================================================

CREATE SCHEMA IF NOT EXISTS inventory;
COMMENT ON SCHEMA inventory IS 'ERP Lite: Items, categories, barcodes, warehouses, stock ledger. StockReservation/PriceList deferred to Enterprise tier.';

CREATE TABLE inventory.item_category (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    category_name       VARCHAR(150) NOT NULL,
    parent_category_id  BIGINT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_item_category__uuid UNIQUE (uuid),
    CONSTRAINT fk_item_category__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_item_category__parent FOREIGN KEY (parent_category_id) REFERENCES inventory.item_category (id)
);
CREATE INDEX ix_item_category__company ON inventory.item_category (company_id) WHERE is_deleted = false;

CREATE TABLE inventory.item (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    item_code           VARCHAR(50) NOT NULL,
    item_name           VARCHAR(255) NOT NULL,
    item_category_id    BIGINT NOT NULL,
    base_uom_id         BIGINT NOT NULL,
    default_tax_rate_id BIGINT,
    version_no          INTEGER NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT,
    deleted_at          TIMESTAMPTZ,
    deleted_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    custom_fields       JSONB,
    -- BD-010: item_code permanently reserved after soft delete (no reuse) — audit integrity,
    -- same policy as app_user.username/email.
    CONSTRAINT uq_item__uuid UNIQUE (uuid),
    CONSTRAINT uq_item__company_code UNIQUE (company_id, item_code),
    CONSTRAINT fk_item__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_item__category FOREIGN KEY (item_category_id) REFERENCES inventory.item_category (id),
    CONSTRAINT fk_item__base_uom FOREIGN KEY (base_uom_id) REFERENCES core.unit_of_measure (id),
    CONSTRAINT fk_item__default_tax_rate FOREIGN KEY (default_tax_rate_id) REFERENCES core.tax_rate (id)
);
CREATE INDEX ix_item__company_active ON inventory.item (company_id) WHERE is_deleted = false;
CREATE INDEX ix_item__name_search ON inventory.item USING gin (item_name gin_trgm_ops);

CREATE TABLE inventory.barcode (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_id         BIGINT NOT NULL,
    barcode_value   VARCHAR(100) NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    version_no      INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_barcode__value UNIQUE (barcode_value),
    CONSTRAINT fk_barcode__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);
CREATE INDEX ix_barcode__item ON inventory.barcode (item_id);

CREATE TABLE inventory.warehouse (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                    UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id              BIGINT NOT NULL,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    branch_id               BIGINT,     -- nullable: central warehouse shared across branches
    warehouse_name          VARCHAR(200) NOT NULL,
    allow_negative_stock    BOOLEAN NOT NULL DEFAULT false,   -- BD-001
    is_active               BOOLEAN NOT NULL DEFAULT true,
    is_deleted              BOOLEAN NOT NULL DEFAULT false,
    version_no              INTEGER NOT NULL DEFAULT 1,
    custom_fields           JSONB,
    CONSTRAINT uq_warehouse__uuid UNIQUE (uuid),
    CONSTRAINT fk_warehouse__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    -- composite FK guarantees the branch actually belongs to the same company (lesson: REV5-010)
    CONSTRAINT fk_warehouse__branch_company FOREIGN KEY (branch_id, company_id) REFERENCES core.branch (id, company_id)
);
CREATE INDEX ix_warehouse__company ON inventory.warehouse (company_id) WHERE is_deleted = false;

-- StockLedgerEntry: single source of truth for quantity. Monthly partitioned, append-only.
CREATE TABLE inventory.stock_ledger_entry (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    item_id             BIGINT NOT NULL,
    warehouse_id        BIGINT NOT NULL,
    qty_change          NUMERIC(18,4) NOT NULL,
    valuation_rate      NUMERIC(18,2),
    source_doctype      VARCHAR(100) NOT NULL,   -- polymorphic source, no FK (Service Layer verified)
    source_uuid         UUID NOT NULL,
    posting_date        DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    PRIMARY KEY (id, posting_date)
) PARTITION BY RANGE (posting_date);
COMMENT ON TABLE inventory.stock_ledger_entry IS 'Single source of truth for stock quantity. Append-only.';
CREATE INDEX ix_stock_ledger_entry__item_warehouse_date ON inventory.stock_ledger_entry (item_id, warehouse_id, posting_date);

CREATE TABLE inventory.stock_adjustment (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    branch_id       BIGINT,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    document_number VARCHAR(50) NOT NULL,
    warehouse_id    BIGINT NOT NULL,
    posting_date    DATE NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
    reason          VARCHAR(255),
    version_no      INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    custom_fields   JSONB,
    CONSTRAINT uq_stock_adjustment__uuid UNIQUE (uuid),
    CONSTRAINT uq_stock_adjustment__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_stock_adjustment__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_stock_adjustment__warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory.warehouse (id),
    CONSTRAINT ck_stock_adjustment__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);
CREATE INDEX ix_stock_adjustment__company_branch_status ON inventory.stock_adjustment (company_id, branch_id, status);

CREATE TABLE inventory.stock_adjustment_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_adjustment_id     BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty_variance            NUMERIC(18,4) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              BIGINT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by              BIGINT,
    version_no              INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_stock_adjustment_line__adjustment FOREIGN KEY (stock_adjustment_id) REFERENCES inventory.stock_adjustment (id),
    CONSTRAINT fk_stock_adjustment_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE inventory.stock_transfer (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    from_warehouse_id   BIGINT NOT NULL,
    to_warehouse_id     BIGINT NOT NULL,
    posting_date        DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_stock_transfer__uuid UNIQUE (uuid),
    CONSTRAINT uq_stock_transfer__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_stock_transfer__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_stock_transfer__from_wh FOREIGN KEY (from_warehouse_id) REFERENCES inventory.warehouse (id),
    CONSTRAINT fk_stock_transfer__to_wh   FOREIGN KEY (to_warehouse_id)   REFERENCES inventory.warehouse (id),
    CONSTRAINT ck_stock_transfer__different_warehouses CHECK (from_warehouse_id <> to_warehouse_id),
    CONSTRAINT ck_stock_transfer__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);
CREATE INDEX ix_stock_transfer__company_branch_status ON inventory.stock_transfer (company_id, branch_id, status);

CREATE TABLE inventory.stock_transfer_line (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stock_transfer_id   BIGINT NOT NULL,
    item_id             BIGINT NOT NULL,
    qty                 NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT,
    version_no          INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_stock_transfer_line__transfer FOREIGN KEY (stock_transfer_id) REFERENCES inventory.stock_transfer (id),
    CONSTRAINT fk_stock_transfer_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);
