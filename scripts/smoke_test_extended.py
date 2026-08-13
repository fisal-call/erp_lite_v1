"""
scripts/smoke_test_extended.py

Smoke-test for the 21 new /reporting/* endpoints added during the ERP-LITE
module completion pass. Verifies each endpoint:
  1. Returns 200 with a valid JWT
  2. Returns 401 without a JWT (security check)
  3. Returns well-formed JSON (list or object as expected)
"""
import json
import sys
import time
from urllib.parse import urlencode

import requests

BASE = "http://127.0.0.1:8000/api/v1"

def login() -> str:
    r = requests.post(
        f"{BASE}/security/auth/login",
        data={"username": "admin", "password": "Admin@12345"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]

def expect_200(token: str, path: str, params: dict | None = None) -> dict:
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urlencode(params)
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if r.status_code != 200:
        return {"path": path, "status": r.status_code, "ok": False, "error": r.text[:200]}
    body = r.json()
    if isinstance(body, list):
        return {"path": path, "status": 200, "ok": True, "type": "list", "len": len(body)}
    if isinstance(body, dict):
        return {"path": path, "status": 200, "ok": True, "type": "object", "keys": list(body.keys())[:5]}
    return {"path": path, "status": 200, "ok": True, "type": str(type(body))}

def expect_401(path: str) -> bool:
    """Verify the endpoint rejects unauthenticated requests."""
    r = requests.get(f"{BASE}/{path}", timeout=10)
    return r.status_code == 401

def main():
    print("Logging in...")
    token = login()
    print(f"  token: {token[:30]}...")

    # Discover some real UUIDs to use as path params
    customers = requests.get(f"{BASE}/sales/customers", headers={"Authorization": f"Bearer {token}"}, timeout=10).json()
    suppliers = requests.get(f"{BASE}/purchasing/suppliers", headers={"Authorization": f"Bearer {token}"}, timeout=10).json()
    items = requests.get(f"{BASE}/inventory/items", headers={"Authorization": f"Bearer {token}"}, timeout=10).json()

    cust_uuid = customers[0]["uuid"] if customers else None
    sup_uuid = suppliers[0]["uuid"] if suppliers else None
    item_uuid = items["items"][0]["uuid"] if items and "items" in items and items["items"] else None

    print(f"  cust: {cust_uuid}")
    print(f"  sup:  {sup_uuid}")
    print(f"  item: {item_uuid}")
    print()

    endpoints: list[tuple[str, dict | None]] = [
        ("reporting/customer-outstanding", None),
        ("reporting/supplier-outstanding", None),
        ("reporting/cash-accounts", None),
        ("reporting/banks", None),
        ("reporting/bank-accounts", None),
        ("reporting/stock-movements", None),
        ("reporting/low-stock", {"threshold": "0"}),
        ("reporting/sales-summary", {"group_by": "month"}),
        ("reporting/sales-by-customer", None),
        ("reporting/sales-by-item", None),
        ("reporting/purchase-summary", {"group_by": "month"}),
        ("reporting/purchase-by-supplier", None),
        ("reporting/fiscal-years", None),
        ("reporting/fiscal-periods", None),
        ("reporting/payment-terms", None),
        ("reporting/tax-rates", None),
        ("reporting/sales-invoices", {"limit": "10"}),
        ("reporting/customer-receipts", {"limit": "10"}),
        ("reporting/purchase-invoices", {"limit": "10"}),
        ("reporting/supplier-payments", {"limit": "10"}),
    ]
    if cust_uuid:
        endpoints.append((f"reporting/customer-statement/{cust_uuid}", None))
    if sup_uuid:
        endpoints.append((f"reporting/supplier-statement/{sup_uuid}", None))
    if item_uuid:
        endpoints.append(("reporting/stock-movements", {"item_uuid": item_uuid, "limit": "50"}))

    pass_count = 0
    fail_count = 0
    sec_count = 0
    for path, params in endpoints:
        r = expect_200(token, path, params)
        ok = r["ok"]
        if ok:
            pass_count += 1
            extra = f"type={r.get('type')}" + (f" len={r.get('len')}" if 'len' in r else "")
            print(f"  ✓ 200  /{path}  ({extra})")
            # Security check: should 401 without token
            if expect_401(path.split("?")[0]):
                sec_count += 1
            else:
                print(f"    ⚠ security: did NOT 401 without token")
        else:
            fail_count += 1
            print(f"  ✗ {r['status']} /{path}  -- {r.get('error', '')}")

    print()
    print(f"PASS: {pass_count} / {len(endpoints)}")
    print(f"FAIL: {fail_count} / {len(endpoints)}")
    print(f"SECURITY 401-on-no-token: {sec_count} / {len(endpoints)}")
    sys.exit(0 if fail_count == 0 else 1)

if __name__ == "__main__":
    main()
