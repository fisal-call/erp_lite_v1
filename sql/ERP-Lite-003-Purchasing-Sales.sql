-- =========================================================
-- ERP LITE — PART 3 of 4
-- Schemas: purchasing · sales
-- Depends on: ERP-Lite-001, ERP-Lite-002
-- No PurchaseRequisition (approval-chain heavy — deferred to Enterprise/Approval Matrix tier).
-- No PurchaseReceiptInvoiceMatch N:N table — invoice references a single receipt directly
-- for Lite simplicity; multi-receipt matching deferred to Enterprise tier.
-- =========================================================

CREATE SCHEMA IF NOT EXISTS purchasing;
CREATE SCHEMA IF NOT EXISTS sales;

COMMENT ON SCHEMA purchasing IS 'ERP Lite: Supplier, PO, Receipt, Return, Invoice, Payment.';
COMMENT ON SCHEMA sales      IS 'ERP Lite: Customer, Quotation, Order, Delivery, Invoice, Return, Receipt.';

-- =========================================================
-- SCHEMA: purchasing
-- =========================================================

CREATE TABLE purchasing.supplier (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    supplier_code   VARCHAR(50) NOT NULL,
    supplier_name   VARCHAR(200) NOT NULL,
    payment_term_id BIGINT,
    phone           VARCHAR(30),
    email           VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT true,     -- false = "blacklisted", BR-PUR-010
    version_no      INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT,
    deleted_at      TIMESTAMPTZ,
    deleted_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,    -- BR-PUR-013: never hard-deleted once used
    custom_fields   JSONB,
    CONSTRAINT uq_supplier__uuid UNIQUE (uuid),
    CONSTRAINT uq_supplier__company_code UNIQUE (company_id, supplier_code),
    CONSTRAINT fk_supplier__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_supplier__payment_term FOREIGN KEY (payment_term_id) REFERENCES core.payment_term (id)
);
CREATE INDEX ix_supplier__company_active ON purchasing.supplier (company_id) WHERE is_deleted = false;
CREATE INDEX ix_supplier__name_search ON purchasing.supplier USING gin (supplier_name gin_trgm_ops);

CREATE TABLE purchasing.purchase_order (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    supplier_id         BIGINT NOT NULL,
    document_date       DATE NOT NULL,
    currency_id         BIGINT NOT NULL,
    exchange_rate       NUMERIC(18,8) NOT NULL DEFAULT 1,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    custom_fields       JSONB,
    CONSTRAINT uq_purchase_order__uuid UNIQUE (uuid),
    CONSTRAINT uq_purchase_order__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_purchase_order__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_purchase_order__supplier FOREIGN KEY (supplier_id) REFERENCES purchasing.supplier (id),
    CONSTRAINT fk_purchase_order__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id),
    CONSTRAINT ck_purchase_order__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);
CREATE INDEX ix_purchase_order__company_branch_status ON purchasing.purchase_order (company_id, branch_id, status);

CREATE TABLE purchasing.purchase_order_line (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id   BIGINT NOT NULL,
    item_id             BIGINT NOT NULL,
    qty_ordered         NUMERIC(18,4) NOT NULL CHECK (qty_ordered > 0),
    rate                NUMERIC(18,2) NOT NULL CHECK (rate >= 0),
    tax_rate_id         BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT,
    version_no          INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_purchase_order_line__order FOREIGN KEY (purchase_order_id) REFERENCES purchasing.purchase_order (id),
    CONSTRAINT fk_purchase_order_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id),
    CONSTRAINT fk_purchase_order_line__tax FOREIGN KEY (tax_rate_id) REFERENCES core.tax_rate (id)
);

CREATE TABLE purchasing.purchase_receipt (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    purchase_order_id   BIGINT NOT NULL,
    warehouse_id        BIGINT NOT NULL,
    posting_date        DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_purchase_receipt__uuid UNIQUE (uuid),
    CONSTRAINT uq_purchase_receipt__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_purchase_receipt__order FOREIGN KEY (purchase_order_id) REFERENCES purchasing.purchase_order (id),
    CONSTRAINT fk_purchase_receipt__warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory.warehouse (id),
    CONSTRAINT ck_purchase_receipt__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);

CREATE TABLE purchasing.purchase_receipt_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_receipt_id     BIGINT NOT NULL,
    purchase_order_line_id  BIGINT,
    item_id                 BIGINT NOT NULL,
    qty_received             NUMERIC(18,4) NOT NULL CHECK (qty_received > 0),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               BIGINT,
    version_no                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_purchase_receipt_line__receipt FOREIGN KEY (purchase_receipt_id) REFERENCES purchasing.purchase_receipt (id),
    CONSTRAINT fk_purchase_receipt_line__po_line FOREIGN KEY (purchase_order_line_id) REFERENCES purchasing.purchase_order_line (id),
    CONSTRAINT fk_purchase_receipt_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE purchasing.purchase_return (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    purchase_receipt_id BIGINT NOT NULL,
    posting_date        DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_purchase_return__uuid UNIQUE (uuid),
    CONSTRAINT uq_purchase_return__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_purchase_return__receipt FOREIGN KEY (purchase_receipt_id) REFERENCES purchasing.purchase_receipt (id),
    CONSTRAINT ck_purchase_return__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);

CREATE TABLE purchasing.purchase_return_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_return_id      BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty_returned             NUMERIC(18,4) NOT NULL CHECK (qty_returned > 0),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               BIGINT,
    version_no                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_purchase_return_line__return FOREIGN KEY (purchase_return_id) REFERENCES purchasing.purchase_return (id),
    CONSTRAINT fk_purchase_return_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE purchasing.purchase_invoice (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    supplier_id         BIGINT NOT NULL,
    purchase_receipt_id BIGINT,       -- BR-PUR-004 Three-Way Match reference (single receipt, Lite scope)
    document_date       DATE NOT NULL,
    due_date            DATE,
    currency_id         BIGINT NOT NULL,
    exchange_rate       NUMERIC(18,8) NOT NULL DEFAULT 1,
    total_amount        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    custom_fields       JSONB,
    CONSTRAINT uq_purchase_invoice__uuid UNIQUE (uuid),
    CONSTRAINT uq_purchase_invoice__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_purchase_invoice__supplier FOREIGN KEY (supplier_id) REFERENCES purchasing.supplier (id),
    CONSTRAINT fk_purchase_invoice__receipt FOREIGN KEY (purchase_receipt_id) REFERENCES purchasing.purchase_receipt (id),
    CONSTRAINT fk_purchase_invoice__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id),
    CONSTRAINT ck_purchase_invoice__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')),
    CONSTRAINT ck_purchase_invoice__paid_not_exceed CHECK (paid_amount <= total_amount)
);
CREATE INDEX ix_purchase_invoice__company_branch_status ON purchasing.purchase_invoice (company_id, branch_id, status);

CREATE TABLE purchasing.purchase_invoice_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_invoice_id      BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty                     NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    rate                    NUMERIC(18,2) NOT NULL CHECK (rate >= 0),
    tax_rate_id             BIGINT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               BIGINT,
    version_no                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_purchase_invoice_line__invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchasing.purchase_invoice (id),
    CONSTRAINT fk_purchase_invoice_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id),
    CONSTRAINT fk_purchase_invoice_line__tax FOREIGN KEY (tax_rate_id) REFERENCES core.tax_rate (id)
);

CREATE TABLE purchasing.supplier_payment (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    supplier_id         BIGINT NOT NULL,
    purchase_invoice_id BIGINT NOT NULL,
    payment_date        DATE NOT NULL,
    amount               NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    payment_method       VARCHAR(20) NOT NULL DEFAULT 'bank',   -- 'cash'/'bank'/'cheque'
    status               VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no            INTEGER NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            BIGINT,
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_supplier_payment__uuid UNIQUE (uuid),
    CONSTRAINT uq_supplier_payment__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_supplier_payment__supplier FOREIGN KEY (supplier_id) REFERENCES purchasing.supplier (id),
    CONSTRAINT fk_supplier_payment__invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchasing.purchase_invoice (id),
    CONSTRAINT ck_supplier_payment__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')),
    CONSTRAINT ck_supplier_payment__method CHECK (payment_method IN ('cash','bank','cheque'))
);

-- =========================================================
-- SCHEMA: sales
-- =========================================================

CREATE TABLE sales.customer (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id      BIGINT NOT NULL,
    tenant_id       BIGINT NOT NULL DEFAULT 1,
    customer_code   VARCHAR(50) NOT NULL,
    customer_name   VARCHAR(200) NOT NULL,
    payment_term_id BIGINT,
    credit_limit    NUMERIC(18,2),
    phone           VARCHAR(30),
    email           VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT true,     -- false = "suspended", BR-SAL-009
    version_no      INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      BIGINT,
    deleted_at      TIMESTAMPTZ,
    deleted_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT false,    -- BR-SAL-011: never hard-deleted once used
    custom_fields   JSONB,
    CONSTRAINT uq_customer__uuid UNIQUE (uuid),
    CONSTRAINT uq_customer__company_code UNIQUE (company_id, customer_code),
    CONSTRAINT fk_customer__company FOREIGN KEY (company_id) REFERENCES core.company (id),
    CONSTRAINT fk_customer__payment_term FOREIGN KEY (payment_term_id) REFERENCES core.payment_term (id),
    CONSTRAINT ck_customer__credit_limit CHECK (credit_limit IS NULL OR credit_limit >= 0)
);
CREATE INDEX ix_customer__company_active ON sales.customer (company_id) WHERE is_deleted = false;
CREATE INDEX ix_customer__name_search ON sales.customer USING gin (customer_name gin_trgm_ops);

CREATE TABLE sales.sales_quotation (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    customer_id         BIGINT NOT NULL,
    document_date       DATE NOT NULL,
    valid_till          DATE,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_sales_quotation__uuid UNIQUE (uuid),
    CONSTRAINT uq_sales_quotation__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_sales_quotation__customer FOREIGN KEY (customer_id) REFERENCES sales.customer (id),
    CONSTRAINT ck_sales_quotation__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);

CREATE TABLE sales.sales_quotation_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_quotation_id      BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty                     NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    rate                    NUMERIC(18,2) NOT NULL CHECK (rate >= 0),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               BIGINT,
    version_no                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_sales_quotation_line__quotation FOREIGN KEY (sales_quotation_id) REFERENCES sales.sales_quotation (id),
    CONSTRAINT fk_sales_quotation_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE sales.sales_order (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    customer_id         BIGINT NOT NULL,
    sales_quotation_id  BIGINT,
    document_date       DATE NOT NULL,
    currency_id         BIGINT NOT NULL,
    exchange_rate       NUMERIC(18,8) NOT NULL DEFAULT 1,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    custom_fields       JSONB,
    CONSTRAINT uq_sales_order__uuid UNIQUE (uuid),
    CONSTRAINT uq_sales_order__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_sales_order__customer FOREIGN KEY (customer_id) REFERENCES sales.customer (id),
    CONSTRAINT fk_sales_order__quotation FOREIGN KEY (sales_quotation_id) REFERENCES sales.sales_quotation (id),
    CONSTRAINT fk_sales_order__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id),
    CONSTRAINT ck_sales_order__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);
CREATE INDEX ix_sales_order__company_branch_status ON sales.sales_order (company_id, branch_id, status);

CREATE TABLE sales.sales_order_line (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_order_id       BIGINT NOT NULL,
    item_id             BIGINT NOT NULL,
    qty_ordered          NUMERIC(18,4) NOT NULL CHECK (qty_ordered > 0),
    rate                 NUMERIC(18,2) NOT NULL CHECK (rate >= 0),
    tax_rate_id           BIGINT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             BIGINT,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by             BIGINT,
    version_no              INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_sales_order_line__order FOREIGN KEY (sales_order_id) REFERENCES sales.sales_order (id),
    CONSTRAINT fk_sales_order_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id),
    CONSTRAINT fk_sales_order_line__tax FOREIGN KEY (tax_rate_id) REFERENCES core.tax_rate (id)
);

CREATE TABLE sales.sales_delivery (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    sales_order_id      BIGINT NOT NULL,
    warehouse_id        BIGINT NOT NULL,
    posting_date        DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_sales_delivery__uuid UNIQUE (uuid),
    CONSTRAINT uq_sales_delivery__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_sales_delivery__order FOREIGN KEY (sales_order_id) REFERENCES sales.sales_order (id),
    CONSTRAINT fk_sales_delivery__warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory.warehouse (id),
    CONSTRAINT ck_sales_delivery__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);

CREATE TABLE sales.sales_delivery_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_delivery_id        BIGINT NOT NULL,
    sales_order_line_id       BIGINT,
    item_id                 BIGINT NOT NULL,
    qty_delivered             NUMERIC(18,4) NOT NULL CHECK (qty_delivered > 0),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                 BIGINT,
    version_no                  INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_sales_delivery_line__delivery FOREIGN KEY (sales_delivery_id) REFERENCES sales.sales_delivery (id),
    CONSTRAINT fk_sales_delivery_line__so_line FOREIGN KEY (sales_order_line_id) REFERENCES sales.sales_order_line (id),
    CONSTRAINT fk_sales_delivery_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE sales.sales_invoice (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    customer_id         BIGINT NOT NULL,
    sales_delivery_id   BIGINT,       -- nullable: BD-005 Advance Billing (disabled by default — enforced in Service Layer)
    document_date       DATE NOT NULL,
    due_date            DATE,
    currency_id         BIGINT NOT NULL,
    exchange_rate       NUMERIC(18,8) NOT NULL DEFAULT 1,
    total_amount        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    custom_fields       JSONB,
    CONSTRAINT uq_sales_invoice__uuid UNIQUE (uuid),
    CONSTRAINT uq_sales_invoice__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_sales_invoice__customer FOREIGN KEY (customer_id) REFERENCES sales.customer (id),
    CONSTRAINT fk_sales_invoice__delivery FOREIGN KEY (sales_delivery_id) REFERENCES sales.sales_delivery (id),
    CONSTRAINT fk_sales_invoice__currency FOREIGN KEY (currency_id) REFERENCES core.currency (id),
    CONSTRAINT ck_sales_invoice__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')),
    CONSTRAINT ck_sales_invoice__paid_not_exceed CHECK (paid_amount <= total_amount)
);
CREATE INDEX ix_sales_invoice__company_branch_status ON sales.sales_invoice (company_id, branch_id, status);

CREATE TABLE sales.sales_invoice_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_invoice_id         BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty                     NUMERIC(18,4) NOT NULL CHECK (qty > 0),
    rate                    NUMERIC(18,2) NOT NULL CHECK (rate >= 0),
    tax_rate_id             BIGINT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               BIGINT,
    version_no                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_sales_invoice_line__invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales.sales_invoice (id),
    CONSTRAINT fk_sales_invoice_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id),
    CONSTRAINT fk_sales_invoice_line__tax FOREIGN KEY (tax_rate_id) REFERENCES core.tax_rate (id)
);

CREATE TABLE sales.sales_return (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    sales_delivery_id   BIGINT NOT NULL,
    posting_date        DATE NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no          INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_sales_return__uuid UNIQUE (uuid),
    CONSTRAINT uq_sales_return__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_sales_return__delivery FOREIGN KEY (sales_delivery_id) REFERENCES sales.sales_delivery (id),
    CONSTRAINT ck_sales_return__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived'))
);

CREATE TABLE sales.sales_return_line (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_return_id          BIGINT NOT NULL,
    item_id                 BIGINT NOT NULL,
    qty_returned             NUMERIC(18,4) NOT NULL CHECK (qty_returned > 0),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                BIGINT,
    version_no                 INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_sales_return_line__return FOREIGN KEY (sales_return_id) REFERENCES sales.sales_return (id),
    CONSTRAINT fk_sales_return_line__item FOREIGN KEY (item_id) REFERENCES inventory.item (id)
);

CREATE TABLE sales.customer_receipt (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID NOT NULL DEFAULT gen_random_uuid(),
    company_id          BIGINT NOT NULL,
    branch_id           BIGINT,
    tenant_id           BIGINT NOT NULL DEFAULT 1,
    document_number     VARCHAR(50) NOT NULL,
    customer_id         BIGINT NOT NULL,
    sales_invoice_id    BIGINT NOT NULL,
    receipt_date        DATE NOT NULL,
    amount               NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    payment_method       VARCHAR(20) NOT NULL DEFAULT 'bank',
    status               VARCHAR(30) NOT NULL DEFAULT 'draft',
    version_no            INTEGER NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            BIGINT,
    is_deleted            BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_customer_receipt__uuid UNIQUE (uuid),
    CONSTRAINT uq_customer_receipt__doc_number UNIQUE (company_id, document_number),
    CONSTRAINT fk_customer_receipt__customer FOREIGN KEY (customer_id) REFERENCES sales.customer (id),
    CONSTRAINT fk_customer_receipt__invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales.sales_invoice (id),
    CONSTRAINT ck_customer_receipt__status CHECK (status IN ('draft','submitted','approved','rejected','cancelled','closed','archived')),
    CONSTRAINT ck_customer_receipt__method CHECK (payment_method IN ('cash','bank','cheque'))
);
