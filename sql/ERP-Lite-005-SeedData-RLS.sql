-- =========================================================
-- ERP LITE — PART 5 of 5
-- Reference Seed Data + Row-Level Security (RLS)
-- Depends on: ERP-Lite-001 through 004 already executed.
--
-- WHY NOW (not deferred): no production data exists yet — this is the cheapest possible
-- moment to enable RLS. Deferring it means the future Backend gets built on the assumption
-- that company_id filtering is a pure application responsibility with no second line of
-- defense. Company/Branch/ChartOfAccounts are NOT seeded here — those are created through
-- the application's company-onboarding flow (ERP-004 §15.7 Bootstrap Company), because they
-- require a real company_id to exist first. Only global, company-independent reference data
-- is seeded here.
-- =========================================================

-- ---------------------------------------------------------
-- PART A — REFERENCE SEED DATA (global, company-independent only)
-- ---------------------------------------------------------

INSERT INTO core.country (iso_code, name_ar, name_en) VALUES
    ('EGY', 'مصر',             'Egypt'),
    ('SAU', 'المملكة العربية السعودية', 'Saudi Arabia'),
    ('ARE', 'الإمارات العربية المتحدة', 'United Arab Emirates'),
    ('USA', 'الولايات المتحدة', 'United States')
ON CONFLICT (iso_code) DO NOTHING;

INSERT INTO core.currency (iso_code, name_ar, name_en, symbol) VALUES
    ('EGP', 'جنيه مصري',  'Egyptian Pound', 'ج.م'),
    ('USD', 'دولار أمريكي', 'US Dollar',      '$'),
    ('SAR', 'ريال سعودي',  'Saudi Riyal',    'ر.س'),
    ('AED', 'درهم إماراتي', 'UAE Dirham',     'د.إ')
ON CONFLICT (iso_code) DO NOTHING;

INSERT INTO core.unit_of_measure (uom_name) VALUES
    ('قطعة'), ('كرتونة'), ('كيلوجرام'), ('لتر'), ('متر')
ON CONFLICT (uom_name) DO NOTHING;

-- Standard roles (global — not company-scoped in this design)
INSERT INTO security.role (role_name, description) VALUES
    ('Admin',            'صلاحيات كاملة على النظام'),
    ('Accountant',       'محاسب — وصول كامل لموديول المحاسبة والكاش والبنوك'),
    ('SalesUser',        'مستخدم مبيعات — عملاء، عروض أسعار، أوامر بيع، فواتير'),
    ('PurchasingUser',   'مستخدم مشتريات — موردين، أوامر شراء، فواتير موردين'),
    ('InventoryClerk',   'أمين مخزن — حركات مخزون، تسويات، تحويلات')
ON CONFLICT (role_name) DO NOTHING;

-- Metadata Engine bootstrap: register the core business DocTypes so the extensibility
-- mechanism (custom_fields) has a foundation from day one (ERP-001 §4).
INSERT INTO system.doc_type (doctype_name, schema_name, table_name, module_name, is_submittable) VALUES
    ('Item',            'inventory',  'item',              'Inventory',  false),
    ('Warehouse',       'inventory',  'warehouse',          'Inventory',  false),
    ('StockAdjustment', 'inventory',  'stock_adjustment',   'Inventory',  true),
    ('StockTransfer',   'inventory',  'stock_transfer',     'Inventory',  true),
    ('Supplier',        'purchasing', 'supplier',           'Purchasing', false),
    ('PurchaseOrder',   'purchasing', 'purchase_order',     'Purchasing', true),
    ('PurchaseReceipt', 'purchasing', 'purchase_receipt',   'Purchasing', true),
    ('PurchaseInvoice', 'purchasing', 'purchase_invoice',   'Purchasing', true),
    ('Customer',        'sales',      'customer',           'Sales',      false),
    ('SalesOrder',      'sales',      'sales_order',        'Sales',      true),
    ('SalesDelivery',   'sales',      'sales_delivery',     'Sales',      true),
    ('SalesInvoice',    'sales',      'sales_invoice',      'Sales',      true),
    ('JournalEntry',    'accounting', 'journal_entry',      'Accounting', true)
ON CONFLICT (doctype_name) DO NOTHING;

-- ---------------------------------------------------------
-- PART B — DATABASE ROLES (technical, per ERP-004 §13.2 — trimmed to Lite scope)
-- ---------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erplite_app_role') THEN
        CREATE ROLE erplite_app_role NOLOGIN NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erplite_readonly_role') THEN
        CREATE ROLE erplite_readonly_role NOLOGIN NOBYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA system, security, core, inventory, purchasing, sales, accounting, reporting TO erplite_app_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA system, security, core, inventory, purchasing, sales, accounting TO erplite_app_role;
-- No DELETE grant: soft delete only (AD-007) — hard delete stays a superuser/admin-only exception.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA system, security, core, inventory, purchasing, sales, accounting TO erplite_app_role;

GRANT USAGE ON SCHEMA reporting TO erplite_readonly_role;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO erplite_readonly_role;

COMMENT ON ROLE erplite_app_role IS 'Backend Service Layer connects as this role. Subject to RLS (NOBYPASSRLS) — the second line of defense described in ERP-004 §13.3.';
COMMENT ON ROLE erplite_readonly_role IS 'Reporting-only connections. reporting schema only, per ERP-004 §1 (no direct access to operational schemas).';

-- ---------------------------------------------------------
-- PART C — ROW-LEVEL SECURITY
-- Session contract (to be set by the Service Layer at the start of every connection/request):
--   SET app.current_company_ids = '1,2,3';   -- comma-separated list of companies this user may access
--   SET app.current_tenant_id   = '1';       -- fixed today (AD-001), dynamic when Multi-Tenant is activated
-- If unset, current_setting(..., true) returns NULL -> policy resolves to false -> zero rows
-- visible. Secure-by-default: no session context means no data, not "see everything".
-- ---------------------------------------------------------

-- core.company itself: no company_id column (it IS the root) — filtered by its own id.
ALTER TABLE core.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.company FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_company_isolation ON core.company
    USING (
        id = ANY(string_to_array(NULLIF(current_setting('app.current_company_ids', true), ''), ',')::bigint[])
        AND tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), '')::bigint, 1)
    );

-- Every other table carrying company_id directly gets the identical standard policy,
-- applied uniformly via a loop to guarantee zero missed tables (the exact class of mistake
-- caught in ERP-005R — automating this removes that risk class entirely).
DO $$
DECLARE
    tbl RECORD;
    tables_with_company_id TEXT[] := ARRAY[
        'core.branch', 'core.tax_rate', 'core.fiscal_year', 'core.payment_term',
        'security.user_company_access',
        'inventory.item_category', 'inventory.item', 'inventory.warehouse',
        'inventory.stock_ledger_entry', 'inventory.stock_adjustment', 'inventory.stock_transfer',
        'purchasing.supplier', 'purchasing.purchase_order', 'purchasing.purchase_receipt',
        'purchasing.purchase_return', 'purchasing.purchase_invoice', 'purchasing.supplier_payment',
        'sales.customer', 'sales.sales_quotation', 'sales.sales_order', 'sales.sales_delivery',
        'sales.sales_invoice', 'sales.sales_return', 'sales.customer_receipt',
        'accounting.account', 'accounting.journal_entry', 'accounting.general_ledger_entry',
        'accounting.cash_account', 'accounting.bank_account',
        'system.notification', 'system.attachment', 'system.document_number_counter'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables_with_company_id LOOP
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY;', t);
        EXECUTE format(
            'CREATE POLICY rls_%s_isolation ON %s USING ('
            'company_id = ANY(string_to_array(NULLIF(current_setting(''app.current_company_ids'', true), ''''), '','')::bigint[]) '
            'AND tenant_id = COALESCE(NULLIF(current_setting(''app.current_tenant_id'', true), '''')::bigint, 1)'
            ');',
            replace(t, '.', '_'), t
        );
    END LOOP;
END $$;

-- Grant the two roles created above to the migration-running user for local testing convenience.
-- (In real deployment, the Backend's connection-pool user is granted erplite_app_role directly.)
