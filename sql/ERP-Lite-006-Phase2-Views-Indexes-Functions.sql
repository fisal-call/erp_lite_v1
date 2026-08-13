-- =========================================================
-- ERP LITE — PART 6 of 6 (Phase 2)
-- Additional Indexes (FK join performance) + Reporting Views + One Stored Function
-- Depends on: ERP-Lite-001 through 005 already executed.
--
-- Scope discipline: no new tables, no architectural change. Indexes added are pure
-- performance additions on existing FK columns (safe, additive, zero behavior change).
-- Views are read-only aggregations in the `reporting` schema only (ERP-004 §1: no source
-- data lives there). The one function created encodes the concurrency-safe document
-- numbering contract already documented in ERP-Lite-001 (system.document_number_counter
-- comment) as executable code instead of a comment the Backend team could forget to honor —
-- this is the "only when needed" case for AD-004's narrow function/trigger exception
-- (data-integrity helper, not business logic).
-- =========================================================

-- ---------------------------------------------------------
-- PART A — ADDITIONAL INDEXES (FK join performance)
-- Postgres does NOT auto-index foreign key columns. Every parent->children and
-- document->reference lookup below was previously unindexed.
-- ---------------------------------------------------------

-- Line tables: parent_id lookups (fetching all lines of a document)
CREATE INDEX IF NOT EXISTS ix_stock_adjustment_line__parent   ON inventory.stock_adjustment_line (stock_adjustment_id);
CREATE INDEX IF NOT EXISTS ix_stock_transfer_line__parent     ON inventory.stock_transfer_line (stock_transfer_id);
CREATE INDEX IF NOT EXISTS ix_purchase_order_line__parent     ON purchasing.purchase_order_line (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_purchase_receipt_line__parent   ON purchasing.purchase_receipt_line (purchase_receipt_id);
CREATE INDEX IF NOT EXISTS ix_purchase_return_line__parent    ON purchasing.purchase_return_line (purchase_return_id);
CREATE INDEX IF NOT EXISTS ix_purchase_invoice_line__parent   ON purchasing.purchase_invoice_line (purchase_invoice_id);
CREATE INDEX IF NOT EXISTS ix_sales_quotation_line__parent    ON sales.sales_quotation_line (sales_quotation_id);
CREATE INDEX IF NOT EXISTS ix_sales_order_line__parent        ON sales.sales_order_line (sales_order_id);
CREATE INDEX IF NOT EXISTS ix_sales_delivery_line__parent     ON sales.sales_delivery_line (sales_delivery_id);
CREATE INDEX IF NOT EXISTS ix_sales_invoice_line__parent      ON sales.sales_invoice_line (sales_invoice_id);
CREATE INDEX IF NOT EXISTS ix_sales_return_line__parent       ON sales.sales_return_line (sales_return_id);
CREATE INDEX IF NOT EXISTS ix_journal_entry_line__parent      ON accounting.journal_entry_line (journal_entry_id);

-- Line tables: item_id lookups ("everywhere this item was ordered/sold/received")
CREATE INDEX IF NOT EXISTS ix_purchase_order_line__item    ON purchasing.purchase_order_line (item_id);
CREATE INDEX IF NOT EXISTS ix_purchase_receipt_line__item  ON purchasing.purchase_receipt_line (item_id);
CREATE INDEX IF NOT EXISTS ix_purchase_invoice_line__item  ON purchasing.purchase_invoice_line (item_id);
CREATE INDEX IF NOT EXISTS ix_sales_order_line__item       ON sales.sales_order_line (item_id);
CREATE INDEX IF NOT EXISTS ix_sales_delivery_line__item    ON sales.sales_delivery_line (item_id);
CREATE INDEX IF NOT EXISTS ix_sales_invoice_line__item     ON sales.sales_invoice_line (item_id);

-- Document-level cross-references
CREATE INDEX IF NOT EXISTS ix_purchase_receipt__order       ON purchasing.purchase_receipt (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_purchase_invoice__supplier     ON purchasing.purchase_invoice (supplier_id);
CREATE INDEX IF NOT EXISTS ix_purchase_invoice__receipt      ON purchasing.purchase_invoice (purchase_receipt_id);
CREATE INDEX IF NOT EXISTS ix_purchase_return__receipt       ON purchasing.purchase_return (purchase_receipt_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payment__supplier     ON purchasing.supplier_payment (supplier_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payment__invoice      ON purchasing.supplier_payment (purchase_invoice_id);

CREATE INDEX IF NOT EXISTS ix_sales_order__customer          ON sales.sales_order (customer_id);
CREATE INDEX IF NOT EXISTS ix_sales_delivery__order           ON sales.sales_delivery (sales_order_id);
CREATE INDEX IF NOT EXISTS ix_sales_invoice__customer         ON sales.sales_invoice (customer_id);
CREATE INDEX IF NOT EXISTS ix_sales_invoice__delivery          ON sales.sales_invoice (sales_delivery_id);
CREATE INDEX IF NOT EXISTS ix_sales_return__delivery           ON sales.sales_return (sales_delivery_id);
CREATE INDEX IF NOT EXISTS ix_customer_receipt__customer       ON sales.customer_receipt (customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_receipt__invoice        ON sales.customer_receipt (sales_invoice_id);

CREATE INDEX IF NOT EXISTS ix_general_ledger_entry__source     ON accounting.general_ledger_entry (source_doctype, source_uuid);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_entry__source        ON inventory.stock_ledger_entry (source_doctype, source_uuid);

-- ---------------------------------------------------------
-- PART B — REPORTING VIEWS
-- All views are invoker-rights (default) so RLS on underlying tables is enforced exactly as
-- if the caller queried the base table directly — no SECURITY DEFINER used anywhere here.
-- ---------------------------------------------------------

-- Current stock balance per item/warehouse — derived from stock_ledger_entry (BR-INV-001 base data).
CREATE VIEW reporting.v_stock_balance AS
SELECT
    sle.company_id,
    sle.item_id,
    i.item_code,
    i.item_name,
    sle.warehouse_id,
    w.warehouse_name,
    SUM(sle.qty_change) AS qty_on_hand
FROM inventory.stock_ledger_entry sle
JOIN inventory.item i ON i.id = sle.item_id
JOIN inventory.warehouse w ON w.id = sle.warehouse_id
GROUP BY sle.company_id, sle.item_id, i.item_code, i.item_name, sle.warehouse_id, w.warehouse_name;
COMMENT ON VIEW reporting.v_stock_balance IS
    'Live stock balance per item/warehouse. Source of truth remains stock_ledger_entry; '
    'this view is a pure aggregation, never written to.';

-- Customer outstanding balance (AR) — invoice total vs paid, per customer.
CREATE VIEW reporting.v_customer_outstanding AS
SELECT
    si.company_id,
    si.customer_id,
    c.customer_name,
    si.currency_id,
    SUM(si.total_amount) AS total_invoiced,
    SUM(si.paid_amount)  AS total_paid,
    SUM(si.total_amount - si.paid_amount) AS balance_due
FROM sales.sales_invoice si
JOIN sales.customer c ON c.id = si.customer_id
WHERE si.status NOT IN ('cancelled','draft')
GROUP BY si.company_id, si.customer_id, c.customer_name, si.currency_id;
COMMENT ON VIEW reporting.v_customer_outstanding IS 'Accounts Receivable summary per customer (submitted+ invoices only).';

-- Supplier outstanding balance (AP) — invoice total vs paid, per supplier.
CREATE VIEW reporting.v_supplier_outstanding AS
SELECT
    pi.company_id,
    pi.supplier_id,
    s.supplier_name,
    pi.currency_id,
    SUM(pi.total_amount) AS total_invoiced,
    SUM(pi.paid_amount)  AS total_paid,
    SUM(pi.total_amount - pi.paid_amount) AS balance_due
FROM purchasing.purchase_invoice pi
JOIN purchasing.supplier s ON s.id = pi.supplier_id
WHERE pi.status NOT IN ('cancelled','draft')
GROUP BY pi.company_id, pi.supplier_id, s.supplier_name, pi.currency_id;
COMMENT ON VIEW reporting.v_supplier_outstanding IS 'Accounts Payable summary per supplier (submitted+ invoices only).';

-- Trial balance basics — running debit/credit per account, per company.
CREATE VIEW reporting.v_trial_balance AS
SELECT
    gle.company_id,
    gle.account_id,
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(gle.debit_amount)  AS total_debit,
    SUM(gle.credit_amount) AS total_credit,
    SUM(gle.debit_amount) - SUM(gle.credit_amount) AS net_balance
FROM accounting.general_ledger_entry gle
JOIN accounting.account a ON a.id = gle.account_id
WHERE a.is_group = false
GROUP BY gle.company_id, gle.account_id, a.account_code, a.account_name, a.account_type;
COMMENT ON VIEW reporting.v_trial_balance IS 'Trial balance: net debit/credit per detail account (is_group=false only, per BR-ACC-006).';

GRANT SELECT ON reporting.v_stock_balance, reporting.v_customer_outstanding,
                 reporting.v_supplier_outstanding, reporting.v_trial_balance
      TO erplite_app_role, erplite_readonly_role;

-- ---------------------------------------------------------
-- PART C — DOCUMENT NUMBERING FUNCTION
-- Encodes the SELECT ... FOR UPDATE contract (documented in ERP-Lite-001) as a single
-- atomic call, removing the risk of the Backend forgetting to lock the counter row.
-- Data-integrity helper only (generates a string), no business rule logic — consistent
-- with the narrow AD-004 exception for functions.
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION system.fn_next_document_number(
    p_company_id     BIGINT,
    p_doctype_name    VARCHAR,
    p_fiscal_year_id  BIGINT DEFAULT NULL,
    p_prefix          VARCHAR DEFAULT NULL
) RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_number BIGINT;
    v_prefix      VARCHAR;
BEGIN
    -- Ensure the counter row exists (first document of its kind for this scope).
    -- Conflict target must match the COALESCE-based unique index exactly (see ERP-Lite-001).
    INSERT INTO system.document_number_counter (company_id, doctype_name, fiscal_year_id, prefix, last_number)
    VALUES (p_company_id, p_doctype_name, p_fiscal_year_id, COALESCE(p_prefix, ''), 0)
    ON CONFLICT (company_id, doctype_name, (COALESCE(fiscal_year_id, -1))) DO NOTHING;

    -- Atomic read-increment-write: SELECT FOR UPDATE locks the row for the duration of the
    -- transaction, serializing concurrent callers for the same (company, doctype, fiscal_year)
    -- scope and guaranteeing no gaps and no duplicates under concurrent load (PDR-008, BD-007).
    SELECT last_number + 1, prefix INTO v_next_number, v_prefix
    FROM system.document_number_counter
    WHERE company_id = p_company_id
      AND doctype_name = p_doctype_name
      AND fiscal_year_id IS NOT DISTINCT FROM p_fiscal_year_id
    FOR UPDATE;

    UPDATE system.document_number_counter
    SET last_number = v_next_number, updated_at = now()
    WHERE company_id = p_company_id
      AND doctype_name = p_doctype_name
      AND fiscal_year_id IS NOT DISTINCT FROM p_fiscal_year_id;

    RETURN v_prefix || lpad(v_next_number::text, 6, '0');
END;
$$;
COMMENT ON FUNCTION system.fn_next_document_number IS
    'PDR-008/REV5-037: atomic, gap-free, race-condition-safe document number generator. '
    'The Backend MUST call this instead of reading/incrementing document_number_counter manually.';

GRANT EXECUTE ON FUNCTION system.fn_next_document_number TO erplite_app_role;
