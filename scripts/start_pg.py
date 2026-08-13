"""
Start a self-contained PostgreSQL server (no root needed).
Uses pgserver (pip package) which bundles a PostgreSQL 17 binary.

The server keeps running after this script exits (cleanup_mode=None).
Connection info is written to /home/z/my-project/pginfo.json for other scripts.
"""
import os
import sys
import json
import subprocess
from pathlib import Path

import pgserver

PGDATA = Path("/home/z/my-project/pgdata")
DBNAME = "erplite"
DBUSER = "erplite"
DBPASS = "erplite_dev"

PGDATA.mkdir(parents=True, exist_ok=True)

print(f"[pg] starting PostgreSQL server at {PGDATA} (cleanup_mode=None, persists) ...")
# cleanup_mode=None keeps the server running after this process exits
server = pgserver.PostgresServer(PGDATA, cleanup_mode=None)

uri = server.get_uri()
print(f"[pg] running. URI = {uri}")

# Create role + database via psql
# psql connects to the 'postgres' default DB
def psql(sql: str, db: str = "postgres"):
    return server.psql(f"\\connect {db}\n{sql}")

# 1) Create role (idempotent)
server.psql(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{DBUSER}') THEN CREATE ROLE {DBUSER} WITH LOGIN PASSWORD '{DBPASS}'; ELSE ALTER ROLE {DBUSER} WITH LOGIN PASSWORD '{DBPASS}'; END IF; END $$;")

# 2) Create database (idempotent)
server.psql(f"SELECT 'CREATE DATABASE {DBNAME} OWNER {DBUSER}' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '{DBNAME}')\\gexec")

# 3) Grant privileges
server.psql(f"ALTER DATABASE {DBNAME} OWNER TO {DBUSER}; GRANT ALL PRIVILEGES ON DATABASE {DBNAME} TO {DBUSER};")

# Write info file for other scripts to use
info = {
    "pgdata": str(PGDATA),
    "uri": uri,
    "user": DBUSER,
    "password": DBPASS,
    "database": DBNAME,
    "psql_uri": uri,  # connects to default 'postgres' db
    "psql_uri_db": uri.rstrip("postgres'") if uri.endswith("'") else uri,  # for reference
}
with open("/home/z/my-project/pginfo.json", "w") as f:
    json.dump(info, f, indent=2)

print("[pg] connection info:")
print(json.dumps(info, indent=2))
print("[pg] DONE")
