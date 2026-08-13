"""
Apply all SQL migrations in order to the erplite database.

This script also patches migrations on the fly to work with the bundled
PostgreSQL 16 from pgserver, which lacks pgcrypto and pg_trgm extensions:
  - Removes 'CREATE EXTENSION pgcrypto' (gen_random_uuid is built-in in PG13+)
  - Removes 'CREATE EXTENSION pg_trgm'
  - Replaces 'gin (col gin_trgm_ops)' indexes with 'gin (col gin_trgm_ops)'
    → these are skipped entirely (search falls back to LIKE)
"""
import sys
import os
import re
import subprocess
import inspect
from pathlib import Path

import pgserver

PGDATA = Path("/home/z/my-project/pgdata")
DBNAME = "erplite"
MIGRATIONS_DIR = Path("/home/z/my-project/sql")
PATCHED_DIR = Path("/home/z/my-project/scripts/sql_patched")
PATCHED_DIR.mkdir(parents=True, exist_ok=True)

migrations = sorted(MIGRATIONS_DIR.glob("ERP-Lite-*.sql"))
print(f"[migrate] found {len(migrations)} migration files")

PSQL_BIN = str(Path(pgserver._commands.__file__).parent / "pginstall" / "bin" / "psql")
print(f"[migrate] using psql at: {PSQL_BIN}")

base_uri = f"postgresql://postgres:@/{DBNAME}?host={PGDATA}"

def patch_sql(text: str) -> str:
    # 1) Remove CREATE EXTENSION pgcrypto / pg_trgm lines
    text = re.sub(r"CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;", "", text)
    text = re.sub(r"CREATE EXTENSION IF NOT EXISTS pg_trgm\s*;", "", text)
    # 2) Skip indexes that use gin_trgm_ops (these require pg_trgm).
    #    Comment them out with -- so psql doesn't run them.
    #    These are typically single-line CREATE INDEX statements.
    lines = text.split("\n")
    out_lines = []
    for line in lines:
        if "gin_trgm_ops" in line.lower():
            out_lines.append("-- [PATCHED] skipped (pg_trgm not available): " + line)
        else:
            out_lines.append(line)
    return "\n".join(out_lines)

# Re-attach to running server
server = pgserver.PostgresServer(PGDATA, cleanup_mode=None)

for m in migrations:
    print(f"\n[migrate] applying {m.name} ...")
    raw = m.read_text(encoding="utf-8")
    patched = patch_sql(raw)
    patched_path = PATCHED_DIR / m.name
    patched_path.write_text(patched, encoding="utf-8")
    with open(patched_path, "rb") as f:
        sql_content = f.read()
    result = subprocess.run(
        [PSQL_BIN, "-v", "ON_ERROR_STOP=1", "-X", "-q", base_uri],
        input=sql_content,
        capture_output=True,
    )
    if result.returncode != 0:
        print(f"[migrate] FAILED on {m.name}")
        print("STDOUT:", result.stdout.decode()[:4000])
        print("STDERR:", result.stderr.decode()[:4000])
        sys.exit(1)
    err = result.stderr.decode().strip()
    if err:
        for line in err.split("\n")[-5:]:
            print(f"  {line}")
    print(f"  OK ({len(sql_content)} bytes)")

print("\n[migrate] ALL migrations applied successfully.")

# Show summary: tables per schema
print("\n[migrate] table count per schema:")
result = subprocess.run(
    [PSQL_BIN, "-X", "-q", "-A", "-t", "-F", "|", base_uri,
     "-c", "SELECT table_schema, COUNT(*) FROM information_schema.tables WHERE table_schema IN ('system','security','core','inventory','purchasing','sales','accounting','reference','reporting') GROUP BY table_schema ORDER BY 1;"],
    capture_output=True,
)
print(result.stdout.decode())
if result.stderr.decode().strip():
    print("STDERR:", result.stderr.decode()[:2000])
