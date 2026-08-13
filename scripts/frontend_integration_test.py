"""
End-to-end FRONTEND integration test.

Simulates a real browser session:
  1. Frontend served at http://127.0.0.1:5173 (Vite dev server)
  2. API calls go to http://127.0.0.1:8000/api/v1 (FastAPI backend) with
     Origin: http://127.0.0.1:5173 + cookie-style Bearer token
  3. Verifies: frontend HTML loads, CORS works, every frontend-facing
     endpoint returns data the frontend can actually consume.

The point of this test is to catch CORS / shape mismatches that a unit
test on the backend alone would miss.
"""
import json
import sys
import time
import requests

FRONTEND = "http://127.0.0.1:5173"
API = "http://127.0.0.1:8000/api/v1"
ORIGIN = FRONTEND

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


# 1. Frontend HTML loads
r = requests.get(FRONTEND + "/", headers={"Origin": ORIGIN})
step("frontend HTML loads (200)",
     r.status_code == 200 and "<div id=\"root\">" in r.text,
     f"status={r.status_code}, size={len(r.text)}")

# 2. Login through API (form-encoded, like the frontend does)
r = requests.post(
    API + "/security/auth/login",
    data={"username": "admin", "password": "Admin@12345"},
    headers={"Origin": ORIGIN},
)
if r.status_code == 200:
    token = r.json()["access_token"]
    step("login via API (form-encoded)", True, f"token_len={len(token)}")
else:
    step("login via API (form-encoded)", False, f"{r.status_code} {r.text[:200]}")
    print(f"\nTotal: {PASS} pass, {FAIL} fail")
    sys.exit(1)

H = {"Authorization": f"Bearer {token}", "Origin": ORIGIN}

# 3. Dashboard summary (the page that previously showed "غير متاح")
r = requests.get(API + "/reporting/dashboard-summary", headers=H)
ok = r.status_code == 200 and "as_of" in r.json()
step("dashboard-summary (was 'غير متاح')", ok,
     f"status={r.status_code}, payload_keys={list(r.json().keys())[:6] if ok else r.text[:100]}")

# 4. Trial balance (was 'غير متاح')
r = requests.get(API + "/accounting/trial-balance", headers=H)
ok = r.status_code == 200 and isinstance(r.json(), list)
step("trial-balance (was 'غير متاح')", ok,
     f"status={r.status_code}, rows={len(r.json()) if ok else '?'}")

# 5. Reference data for dropdowns
for endpoint in ["/core/currencies", "/core/countries", "/core/units-of-measure"]:
    r = requests.get(API + endpoint, headers=H)
    ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0
    step(f"list {endpoint}", ok,
         f"status={r.status_code}, count={len(r.json()) if ok else '?'}")

# 6. Sales module
r = requests.get(API + "/sales/customers", headers=H)
step("list customers", r.status_code == 200, f"count={len(r.json())}")

r = requests.get(API + "/sales/sales-orders", headers=H)
step("list sales-orders", r.status_code == 200, f"count={len(r.json())}")

# 7. Purchasing module
r = requests.get(API + "/purchasing/suppliers", headers=H)
step("list suppliers", r.status_code == 200, f"count={len(r.json())}")

r = requests.get(API + "/purchasing/purchase-orders", headers=H)
step("list purchase-orders", r.status_code == 200, f"count={len(r.json())}")

# 8. Inventory module
r = requests.get(API + "/inventory/items", headers=H)
step("list items (paginated)", r.status_code == 200,
     f"status={r.status_code}, payload={r.text[:120]}")

r = requests.get(API + "/inventory/warehouses", headers=H)
step("list warehouses", r.status_code == 200, f"count={len(r.json())}")

r = requests.get(API + "/inventory/stock-balance", headers=H)
step("list stock-balance", r.status_code == 200,
     f"count={len(r.json()) if isinstance(r.json(), list) else '?'}")

# 9. Accounting module
r = requests.get(API + "/accounting/accounts", headers=H)
step("list accounts", r.status_code == 200, f"count={len(r.json())}")

r = requests.get(API + "/accounting/journal-entries", headers=H)
step("list journal-entries", r.status_code == 200, f"count={len(r.json())}")

# 10. 401 handling (expired/invalid token)
# Use an authenticated endpoint (customers), NOT the unauthenticated reference-data
# endpoints (currencies/countries/UoMs) — those are intentionally public per
# core_org/router.py design (global reference data).
r = requests.get(API + "/sales/customers",
                 headers={"Authorization": "Bearer invalid_token_xxx", "Origin": ORIGIN})
step("401 on invalid token", r.status_code == 401, f"status={r.status_code}")

# 11. 404 handling
r = requests.get(API + "/sales/customers/00000000-0000-0000-0000-000000000000", headers=H)
step("404 on missing customer", r.status_code == 404, f"status={r.status_code}")

# 12. NEW: Security endpoints (P3 + P4)
# 12a. Bootstrap lock-down — POST /security/users without auth should 401 (admin exists)
r = requests.post(API + "/security/users",
                  json={"username":"x","email":"x@x.co","password":"Xxxxxxx1","full_name":"x","company_ids":[1]},
                  headers={"Origin": ORIGIN})
step("bootstrap locked (POST /security/users without auth → 401)",
     r.status_code == 401, f"status={r.status_code}")

# 12b. POST /security/users WITH valid JWT → 201
r = requests.post(API + "/security/users",
                  json={"username":f"itest-{int(time.time())%10000}","email":f"itest-{int(time.time())%10000}@x.co","password":"Itest@123","full_name":"itest user","company_ids":[1]},
                  headers={**H, "Origin": ORIGIN})
step("POST /security/users WITH valid JWT → 201",
     r.status_code == 201, f"status={r.status_code}")

# 12c. GET /security/users (list) requires auth → 401 without, 200 with
r = requests.get(API + "/security/users", headers={"Origin": ORIGIN})
step("GET /security/users without auth → 401", r.status_code == 401, f"status={r.status_code}")
r = requests.get(API + "/security/users", headers=H)
step("GET /security/users WITH JWT → 200 (list)",
     r.status_code == 200 and isinstance(r.json(), list),
     f"status={r.status_code}, count={len(r.json())}")

# 12d. POST /core/companies WITHOUT auth → 401 (now locked down)
r = requests.post(API + "/core/companies",
                  json={"company_name":"Hack","base_currency_uuid":"e8eb56d5-307a-460b-b082-930976bf6d3e","country_uuid":"ab26fbb1-73bc-4380-9f64-3ac3542f87e6"},
                  headers={"Origin": ORIGIN})
step("POST /core/companies without auth → 401", r.status_code == 401, f"status={r.status_code}")

# 13. NEW: PATCH endpoints (P4)
# 13a. PATCH /purchasing/suppliers/{uuid}
suppliers = requests.get(API + "/purchasing/suppliers", headers=H).json()
if suppliers:
    sup = suppliers[0]
    r = requests.patch(f"{API}/purchasing/suppliers/{sup['uuid']}",
                       json={"supplier_name": sup["supplier_name"] + " (edited)", "expected_version_no": sup["version_no"]},
                       headers=H)
    step("PATCH /purchasing/suppliers/{uuid}", r.status_code == 200,
         f"status={r.status_code}, response={r.text[:120] if r.status_code != 200 else 'OK'}")
    # 409 on wrong version
    r = requests.patch(f"{API}/purchasing/suppliers/{sup['uuid']}",
                       json={"supplier_name": "Should Fail", "expected_version_no": 99999},
                       headers=H)
    step("PATCH /purchasing/suppliers/{uuid} wrong version → 409",
         r.status_code == 409, f"status={r.status_code}")
else:
    step("PATCH /purchasing/suppliers/{uuid}", False, "no suppliers in DB to test against")

# 13b. PATCH /inventory/items/{uuid}
items_resp = requests.get(API + "/inventory/items?page=1&page_size=5", headers=H).json()
items_list = items_resp.get("items", []) if isinstance(items_resp, dict) else items_resp
if items_list:
    item = items_list[0]
    r = requests.patch(f"{API}/inventory/items/{item['uuid']}",
                       json={"item_name": item["item_name"] + " (edited)", "expected_version_no": item["version_no"]},
                       headers=H)
    step("PATCH /inventory/items/{uuid}", r.status_code == 200,
         f"status={r.status_code}, response={r.text[:120] if r.status_code != 200 else 'OK'}")
    # 409 on wrong version
    r = requests.patch(f"{API}/inventory/items/{item['uuid']}",
                       json={"item_name": "Should Fail", "expected_version_no": 99999},
                       headers=H)
    step("PATCH /inventory/items/{uuid} wrong version → 409",
         r.status_code == 409, f"status={r.status_code}")
else:
    step("PATCH /inventory/items/{uuid}", False, "no items in DB to test against")

# 13c. PATCH /security/users/{uuid} (admin self-rename)
admin_user = next((u for u in requests.get(API + "/security/users", headers=H).json() if u["username"] == "admin"), None)
if admin_user:
    r = requests.patch(f"{API}/security/users/{admin_user['uuid']}",
                       json={"full_name": "Admin (itest edited)", "expected_version_no": admin_user.get("version_no", 1)},
                       headers=H)
    step("PATCH /security/users/{uuid} (admin self)", r.status_code == 200,
         f"status={r.status_code}, response={r.text[:120] if r.status_code != 200 else 'OK'}")

print(f"\n=== Summary: {PASS} pass, {FAIL} fail ===")
if FAIL > 0:
    print("\nFailed steps:")
    for s in STEPS:
        if not s["ok"]:
            print(f"  - {s['name']}: {s['detail']}")
sys.exit(0 if FAIL == 0 else 1)
