-- =========================================================
-- ERP LITE — PART 7 of 7
-- Bootstrap Role — fixes a real chicken-and-egg RLS bug discovered during
-- Backend Phase 3 completion (integration testing, not code review):
--
--   core.company and security.user_company_access both have FORCE ROW LEVEL
--   SECURITY (ERP-Lite-005). Their policies check "does this row's company_id
--   belong to the caller's session company_ids". For the VERY FIRST company
--   and the VERY FIRST grant of access to it, no session context can ever
--   satisfy that check — the row doesn't exist yet to be "in scope", and a
--   brand-new user by definition has zero company access before this grant.
--   Every normal (non-bootstrap) INSERT into these tables happens later,
--   from an already-authenticated session, and is correctly RLS-protected.
--
-- Fix: a narrow role with BYPASSRLS, used ONLY by the two documented
-- unauthenticated bootstrap endpoints (POST /core/companies, POST
-- /security/users' initial company grant) — never for regular business
-- operations, which continue to use erplite_app_role (NOBYPASSRLS).
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erplite_bootstrap_role') THEN
        CREATE ROLE erplite_bootstrap_role NOLOGIN BYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA core, security TO erplite_bootstrap_role;
GRANT SELECT, INSERT ON core.company, core.branch, core.fiscal_year TO erplite_bootstrap_role;
GRANT SELECT ON core.currency, core.country TO erplite_bootstrap_role;
GRANT SELECT, INSERT ON security.app_user, security.user_company_access TO erplite_bootstrap_role;
-- UPDATE/DELETE added 2026-08-10: PATCH /security/users/{uuid} (authenticated)
-- replaces company_ids wholesale (DELETE+INSERT) and rotates password (UPDATE).
-- Without these grants the endpoint fails with InsufficientPrivilegeError.
GRANT UPDATE, DELETE ON security.app_user, security.user_company_access TO erplite_bootstrap_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, security TO erplite_bootstrap_role;

COMMENT ON ROLE erplite_bootstrap_role IS
    'BYPASSRLS, used by POST /security/users + POST /core/companies (gated by '
    'require_bootstrap_or_admin) AND by PATCH /security/users/{uuid} (gated by '
    'get_current_token). Never used for regular business operations — those '
    'always use erplite_app_role.';

-- IMPORTANT DEPLOYMENT NOTE (discovered via integration testing, not documentation
-- review): PostgreSQL does NOT inherit BYPASSRLS through role membership — it is a
-- direct role attribute only. Whatever LOGIN role the backend actually connects
-- as for bootstrap operations MUST have BYPASSRLS granted to IT directly, e.g.:
--   ALTER ROLE <your_actual_bootstrap_login_role> BYPASSRLS;
-- Simply granting membership in erplite_bootstrap_role (as normally done for
-- erplite_app_role/erplite_readonly_role) is NOT sufficient here.
