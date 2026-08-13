"""اختبار سريع لخادم Flask التجريبي"""
import sys
sys.path.insert(0, '/home/z/my-project/erplite-deploy')
from app import app

client = app.test_client()

tests = [
    ('Login',            lambda: client.post('/api/v1/security/auth/login', data={'username': 'admin', 'password': '123'})),
    ('Currencies',       lambda: client.get('/api/v1/core/currencies')),
    ('Countries',        lambda: client.get('/api/v1/core/countries')),
    ('Customers',        lambda: client.get('/api/v1/sales/customers')),
    ('Sales Orders',     lambda: client.get('/api/v1/sales/sales-orders')),
    ('Suppliers',        lambda: client.get('/api/v1/purchasing/suppliers')),
    ('Purchase Orders',  lambda: client.get('/api/v1/purchasing/purchase-orders')),
    ('Items',            lambda: client.get('/api/v1/inventory/items?page=1&page_size=20')),
    ('Item Categories',  lambda: client.get('/api/v1/inventory/item-categories')),
    ('Warehouses',       lambda: client.get('/api/v1/inventory/warehouses')),
    ('Stock Balance',    lambda: client.get('/api/v1/inventory/stock-balance')),
    ('Accounts',         lambda: client.get('/api/v1/accounting/accounts')),
    ('Journal Entries',  lambda: client.get('/api/v1/accounting/journal-entries')),
    ('Trial Balance',    lambda: client.get('/api/v1/accounting/trial-balance')),
    ('Frontend Index',   lambda: client.get('/')),
]

print('=' * 60)
print('  ERP Lite — Demo Server Test Suite')
print('=' * 60)
all_ok = True
for name, fn in tests:
    r = fn()
    status = '✓' if r.status_code in (200, 201) else '✗'
    if r.status_code not in (200, 201):
        all_ok = False
    if r.is_json:
        body = r.json
        if isinstance(body, list):
            extra = f'{len(body)} records'
        elif isinstance(body, dict):
            extra = f'{len(body)} keys'
        else:
            extra = ''
        print(f'  {status} {name:<20} {r.status_code}  {extra}')
    else:
        print(f'  {status} {name:<20} {r.status_code}  {len(r.data)} bytes')

print('=' * 60)
print(f'  Result: {"ALL PASSED" if all_ok else "SOME FAILED"}')
print('=' * 60)
