#!/usr/bin/env python3
"""
End-to-end smoke test for ERP-Lite backend.

Walks through every CRUD flow:
  login → customer → supplier → item → warehouse → sales-order → submit
       → purchase-order → submit → journal-entry → submit
       → stock-balance → accounts → trial-balance (gap) → dashboard (gap)

Prints pass/fail for each step and exits non-zero on any failure.
"""
import json
import sys
import time
import requests

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin@12345"

PASS = 0
FAIL = 0
STEPS = []

def step(name, ok, detail=""):
    global PASS, FAIL
    status = "✓ PASS" if ok else "✗ FAIL"
    line = f"{status} | {name}"
    if detail:
        line += f" — {detail}"
    print(line)
    STEPS.append({"name": name, "ok": ok, "detail": detail})
    if ok:
        PASS += 1
    else:
        FAIL += 1

def login():
    r = requests.post(f"{BASE}/security/auth/login",
                      data={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        step("login", False, f"{r.status_code} {r.text[:200]}")
        return None
    token = r.json()["access_token"]
    step("login", True, f"token len={len(token)}")
    return {"Authorization": f"Bearer {token}"}

def main():
    headers = login()
    if not headers:
        print(f"\nTotal: {PASS} pass, {FAIL} fail")
        sys.exit(1)

    # 1. Read reference data
    r = requests.get(f"{BASE}/core/currencies", headers=headers)
    currencies = r.json()
    step("list currencies", r.status_code == 200 and len(currencies) >= 1,
         f"count={len(currencies)}")
    egp = next((c for c in currencies if c["iso_code"] == "EGP"), None)

    r = requests.get(f"{BASE}/core/countries", headers=headers)
    countries = r.json()
    step("list countries", r.status_code == 200 and len(countries) >= 1,
         f"count={len(countries)}")

    r = requests.get(f"{BASE}/core/units-of-measure", headers=headers)
    uoms = r.json()
    step("list UoMs", r.status_code == 200 and len(uoms) >= 1,
         f"count={len(uoms)}")
    pcs = next((u for u in uoms if "piece" in u.get("uom_name","").lower() or "قطعة" in u.get("uom_name","")), uoms[0] if uoms else None)

    # 2. Customer (unique code per run)
    import time as _t
    suffix = _t.time_ns() % 100000
    cust_body = {
        "customer_code": f"SMOKE-CUST-{suffix}",
        "customer_name": "Smoke Test Customer",
        "customer_type": "individual",
        "phone": "+201000000000",
        "email": "smoke@test.com",
        "is_active": True,
    }
    r = requests.post(f"{BASE}/sales/customers", json=cust_body, headers=headers)
    if r.status_code == 201:
        customer = r.json()
        cust_uuid = customer["uuid"]
        step("create customer", True, f"uuid={cust_uuid[:8]}...")
    else:
        step("create customer", False, f"{r.status_code} {r.text[:200]}")
        customer = None
        cust_uuid = None

    r = requests.get(f"{BASE}/sales/customers", headers=headers)
    step("list customers", r.status_code == 200, f"count={len(r.json())}")

    if cust_uuid:
        r = requests.get(f"{BASE}/sales/customers/{cust_uuid}", headers=headers)
        step("get customer", r.status_code == 200, f"status={r.status_code}")

        r = requests.patch(f"{BASE}/sales/customers/{cust_uuid}", json={
            "customer_name": "Smoke Test Customer (Updated)",
            "customer_type": "individual",
            "phone": "+201000000001",
            "email": "smoke@test.com",
            "is_active": True,
            "expected_version_no": 1,
        }, headers=headers)
        step("patch customer (optimistic lock)", r.status_code == 200,
             f"status={r.status_code} {r.text[:150] if r.status_code != 200 else ''}")

    # 3. Supplier
    supp_body = {
        "supplier_code": f"SMOKE-SUP-{suffix}",
        "supplier_name": "Smoke Test Supplier",
        "supplier_type": "individual",
        "phone": "+202000000000",
        "email": "supp@test.com",
        "is_active": True,
    }
    r = requests.post(f"{BASE}/purchasing/suppliers", json=supp_body, headers=headers)
    if r.status_code == 201:
        supplier = r.json()
        supp_uuid = supplier["uuid"]
        step("create supplier", True, f"uuid={supp_uuid[:8]}...")
    else:
        step("create supplier", False, f"{r.status_code} {r.text[:200]}")
        supp_uuid = None

    r = requests.get(f"{BASE}/purchasing/suppliers", headers=headers)
    step("list suppliers", r.status_code == 200, f"count={len(r.json())}")

    # 4. Item category
    r = requests.post(f"{BASE}/inventory/item-categories", json={
        "category_name": "Smoke Test Category",
        "is_active": True,
    }, headers=headers)
    if r.status_code == 201:
        cat_uuid = r.json()["uuid"]
        step("create item category", True, f"uuid={cat_uuid[:8]}...")
    else:
        step("create item category", False, f"{r.status_code} {r.text[:200]}")
        cat_uuid = None

    # 5. Warehouse
    r = requests.post(f"{BASE}/inventory/warehouses", json={
        "warehouse_name": "Main Warehouse",
        "is_active": True,
    }, headers=headers)
    if r.status_code == 201:
        wh_uuid = r.json()["uuid"]
        step("create warehouse", True, f"uuid={wh_uuid[:8]}...")
    else:
        step("create warehouse", False, f"{r.status_code} {r.text[:200]}")
        wh_uuid = None

    # 6. Item
    item_body = {
        "item_code": f"SMOKE-{suffix}",
        "item_name": "Smoke Test Item",
        "item_type": "goods",
        "is_active": True,
    }
    if cat_uuid:
        item_body["item_category_uuid"] = cat_uuid
    if pcs:
        item_body["base_uom_uuid"] = pcs["uuid"]
    r = requests.post(f"{BASE}/inventory/items", json=item_body, headers=headers)
    if r.status_code == 201:
        item = r.json()
        item_uuid = item["uuid"]
        step("create item", True, f"uuid={item_uuid[:8]}...")
    else:
        step("create item", False, f"{r.status_code} {r.text[:200]}")
        item_uuid = None

    r = requests.get(f"{BASE}/inventory/items", headers=headers)
    step("list items", r.status_code == 200, f"count={len(r.json())}")

    # 7. Sales order
    so_body = {
        "customer_uuid": cust_uuid,
        "document_date": "2026-08-10",
        "currency_uuid": egp["uuid"] if egp else None,
        "lines": [{
            "item_uuid": item_uuid,
            "qty_ordered": 5,
            "rate": "100.00",
        }] if item_uuid else [],
    }
    r = requests.post(f"{BASE}/sales/sales-orders", json=so_body, headers=headers)
    if r.status_code == 201:
        so_uuid = r.json()["uuid"]
        step("create sales order", True, f"uuid={so_uuid[:8]}...")
    else:
        step("create sales order", False, f"{r.status_code} {r.text[:300]}")
        so_uuid = None

    if so_uuid:
        r = requests.post(f"{BASE}/sales/sales-orders/{so_uuid}/submit", json={"expected_version_no": 1}, headers=headers)
        step("submit sales order", r.status_code == 200, f"status={r.status_code} {r.text[:200] if r.status_code != 200 else ''}")

    # 8. Purchase order
    po_body = {
        "supplier_uuid": supp_uuid,
        "document_date": "2026-08-10",
        "currency_uuid": egp["uuid"] if egp else None,
        "lines": [{
            "item_uuid": item_uuid,
            "qty_ordered": 10,
            "rate": "50.00",
        }] if item_uuid else [],
    }
    r = requests.post(f"{BASE}/purchasing/purchase-orders", json=po_body, headers=headers)
    if r.status_code == 201:
        po_uuid = r.json()["uuid"]
        step("create purchase order", True, f"uuid={po_uuid[:8]}...")
    else:
        step("create purchase order", False, f"{r.status_code} {r.text[:300]}")
        po_uuid = None

    if po_uuid:
        r = requests.post(f"{BASE}/purchasing/purchase-orders/{po_uuid}/submit", json={"expected_version_no": 1}, headers=headers)
        step("submit purchase order", r.status_code == 200, f"status={r.status_code} {r.text[:200] if r.status_code != 200 else ''}")

    # 9. Stock balance
    r = requests.get(f"{BASE}/inventory/stock-balance", headers=headers)
    step("list stock-balance", r.status_code == 200, f"count={len(r.json()) if isinstance(r.json(), list) else '?'}")

    # 10. Accounts (use unique codes to avoid ACC-DUP from previous runs)
    r = requests.post(f"{BASE}/accounting/accounts", json={
        "account_code": f"1{suffix:05d}",
        "account_name": "Cash (Smoke)",
        "account_type": "asset",
        "is_active": True,
    }, headers=headers)
    if r.status_code == 201:
        cash_acc_uuid = r.json()["uuid"]
        step("create account (cash)", True, f"uuid={cash_acc_uuid[:8]}...")
    else:
        step("create account (cash)", False, f"{r.status_code} {r.text[:300]}")
        cash_acc_uuid = None

    r = requests.post(f"{BASE}/accounting/accounts", json={
        "account_code": f"4{suffix:05d}",
        "account_name": "Sales Revenue (Smoke)",
        "account_type": "revenue",
        "is_active": True,
    }, headers=headers)
    if r.status_code == 201:
        rev_acc_uuid = r.json()["uuid"]
        step("create account (revenue)", True, f"uuid={rev_acc_uuid[:8]}...")
    else:
        step("create account (revenue)", False, f"{r.status_code} {r.text[:200]}")
        rev_acc_uuid = None

    r = requests.get(f"{BASE}/accounting/accounts", headers=headers)
    step("list accounts", r.status_code == 200, f"count={len(r.json())}")

    # 11. Journal entry
    if cash_acc_uuid and rev_acc_uuid:
        je_body = {
            "posting_date": "2026-08-10",
            "description": "Smoke test JE",
            "lines": [
                {"account_uuid": cash_acc_uuid, "debit_amount": "100.00", "credit_amount": "0"},
                {"account_uuid": rev_acc_uuid, "debit_amount": "0", "credit_amount": "100.00"},
            ],
        }
        r = requests.post(f"{BASE}/accounting/journal-entries", json=je_body, headers=headers)
        if r.status_code == 201:
            je_uuid = r.json()["uuid"]
            step("create journal entry", True, f"uuid={je_uuid[:8]}...")
        else:
            step("create journal entry", False, f"{r.status_code} {r.text[:300]}")
            je_uuid = None

        if je_uuid:
            r = requests.post(f"{BASE}/accounting/journal-entries/{je_uuid}/submit", headers=headers)
            step("submit journal entry", r.status_code == 200, f"status={r.status_code} {r.text[:200] if r.status_code != 200 else ''}")

    # 12. Trial balance (NOW IMPLEMENTED — should return data from posted GL entries)
    r = requests.get(f"{BASE}/accounting/trial-balance", headers=headers)
    tb_data = r.json() if r.status_code == 200 else []
    step("trial balance endpoint",
         r.status_code == 200 and isinstance(tb_data, list),
         f"status={r.status_code}, rows={len(tb_data) if isinstance(tb_data, list) else '?'}")
    if isinstance(tb_data, list) and tb_data:
        print(f"    sample row: {tb_data[0]}")

    # 13. Dashboard summary (NOW IMPLEMENTED — should return KPIs)
    r = requests.get(f"{BASE}/reporting/dashboard-summary", headers=headers)
    if r.status_code == 200:
        d = r.json()
        step("dashboard-summary endpoint",
             r.status_code == 200 and "as_of" in d,
             f"status={r.status_code}, sales={d.get('total_sales_this_month')}, "
             f"customers={d.get('total_customers')}, items={d.get('total_items')}, "
             f"pending_je={d.get('pending_journal_entries')}")
    else:
        step("dashboard-summary endpoint", False, f"status={r.status_code} {r.text[:200]}")

    print(f"\n=== Summary: {PASS} pass, {FAIL} fail ===")
    if FAIL > 0:
        print("\nFailed steps:")
        for s in STEPS:
            if not s["ok"]:
                print(f"  - {s['name']}: {s['detail']}")
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
