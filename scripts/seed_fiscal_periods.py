"""
Seed core.fiscal_period with 12 monthly periods for FY2026.
Run as postgres (BYPASSRLS) — once, idempotent.
"""
import subprocess
from pathlib import Path
import pgserver

PGDATA = Path("/home/z/my-project/pgdata")
PSQL = str(Path(pgserver._commands.__file__).parent / "pginstall" / "bin" / "psql")
URI = f"postgresql://postgres:@/erplite?host={PGDATA}"

# Get fiscal_year id for FY2026 / company_id=1
res = subprocess.run(
    [PSQL, "-X", "-q", "-A", "-t", URI, "-c",
     "SELECT id FROM core.fiscal_year WHERE company_id=1 AND year_label='FY2026' LIMIT 1;"],
    capture_output=True, text=True
)
fy_id = res.stdout.strip()
print(f"[seed] fiscal_year id = {fy_id}")

if not fy_id:
    print("[seed] ERROR: no fiscal_year row found")
    raise SystemExit(1)

# 12 monthly periods for 2026
months = [
    (1,  "2026-01-01", "2026-01-31"),
    (2,  "2026-02-01", "2026-02-28"),
    (3,  "2026-03-01", "2026-03-31"),
    (4,  "2026-04-01", "2026-04-30"),
    (5,  "2026-05-01", "2026-05-31"),
    (6,  "2026-06-01", "2026-06-30"),
    (7,  "2026-07-01", "2026-07-31"),
    (8,  "2026-08-01", "2026-08-31"),
    (9,  "2026-09-01", "2026-09-30"),
    (10, "2026-10-01", "2026-10-31"),
    (11, "2026-11-01", "2026-11-30"),
    (12, "2026-12-01", "2026-12-31"),
]

# Build a single idempotent INSERT
sql = f"""
INSERT INTO core.fiscal_period (fiscal_year_id, period_number, start_date, end_date, is_closed)
VALUES
"""
rows = []
for pn, sd, ed in months:
    rows.append(f"  ({fy_id}, {pn}, '{sd}'::date, '{ed}'::date, false)")
sql += ",\n".join(rows) + "\n"
sql += "ON CONFLICT (fiscal_year_id, period_number) DO UPDATE SET start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, is_closed=EXCLUDED.is_closed;\n"

# Grant access to erplite_app_role + erplite_bootstrap_role + erplite_readonly_role
sql += """
GRANT SELECT ON core.fiscal_period TO erplite_app_role;
GRANT SELECT ON core.fiscal_period TO erplite_readonly_role;
GRANT SELECT ON core.fiscal_period TO erplite_bootstrap_role;
"""

res = subprocess.run(
    [PSQL, "-X", "-q", "-v", "ON_ERROR_STOP=1", URI],
    input=sql.encode(),
    capture_output=True,
)
print("[seed] stdout:", res.stdout.decode()[:500])
if res.returncode != 0:
    print("[seed] FAILED:", res.stderr.decode()[:1500])
    raise SystemExit(1)

# Verify
res = subprocess.run(
    [PSQL, "-X", "-q", "-A", "-t", "-F", "|", URI, "-c",
     "SELECT id, period_number, start_date, end_date, is_closed FROM core.fiscal_period ORDER BY period_number;"],
    capture_output=True, text=True
)
print("[seed] fiscal_period rows after seed:")
print(res.stdout)
