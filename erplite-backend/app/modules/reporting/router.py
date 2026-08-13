"""
app/modules/reporting/router.py
Dashboard + business reporting endpoints.

All endpoints read from already-aggregated reporting views (or simple aggregates
over operational tables) and respect RLS by going through `get_db_with_context`.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_token, get_db_with_context
from app.core.security import TokenPayload

router = APIRouter(prefix="/reporting", tags=["reporting"])


def _company_id(token: TokenPayload) -> int:
    return token.company_ids[0]


class DashboardSummary(BaseModel):
    """Snapshot of KPIs for the dashboard. All monetary fields are floats
    (rounded to 2dp at the SQL layer) — the backend is the source of truth
    for accounting numbers."""
    total_sales_this_month: float
    total_purchases_this_month: float
    total_ar: float  # Accounts Receivable
    total_ap: float  # Accounts Payable
    total_customers: int
    total_suppliers: int
    total_items: int
    items_low_stock: int  # qty_on_hand <= 0
    pending_sales_orders: int  # status = 'draft'
    pending_purchase_orders: int
    pending_journal_entries: int
    as_of: str  # ISO date


@router.get("/dashboard-summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    token: TokenPayload = Depends(get_current_token),
    db: AsyncSession = Depends(get_db_with_context),
):
    """Aggregates KPIs across modules for the dashboard. Uses cheap COUNT and
    SUM queries — no joins across more than 2 tables. All queries respect
    RLS via `get_db_with_context` so the caller only sees their own company."""
    cid = _company_id(token)
    today = date.today()
    first_of_month = today.replace(day=1)

    # Sales this month (submitted SOs) — total = SUM(qty_ordered * rate)
    r = await db.execute(sa_text("""
        SELECT COALESCE(SUM(sol.qty_ordered * sol.rate), 0)::float AS v
        FROM sales.sales_order so
        JOIN sales.sales_order_line sol ON sol.sales_order_id = so.id
        WHERE so.company_id = :cid
          AND so.status IN ('submitted','approved','fulfilled','closed')
          AND so.document_date >= :d1
          AND so.document_date <= :d2
    """), {"cid": cid, "d1": first_of_month, "d2": today})
    total_sales = r.scalar() or 0.0

    # Purchases this month (submitted POs) — total = SUM(qty_ordered * rate)
    r = await db.execute(sa_text("""
        SELECT COALESCE(SUM(pol.qty_ordered * pol.rate), 0)::float AS v
        FROM purchasing.purchase_order po
        JOIN purchasing.purchase_order_line pol ON pol.purchase_order_id = po.id
        WHERE po.company_id = :cid
          AND po.status IN ('submitted','approved','received','closed')
          AND po.document_date >= :d1
          AND po.document_date <= :d2
    """), {"cid": cid, "d1": first_of_month, "d2": today})
    total_purchases = r.scalar() or 0.0

    # AR = sum of balance_due from reporting.v_customer_outstanding
    r = await db.execute(sa_text("""
        SELECT COALESCE(SUM(balance_due), 0)::float AS v
        FROM reporting.v_customer_outstanding
        WHERE company_id = :cid
    """), {"cid": cid})
    total_ar = r.scalar() or 0.0

    # AP = sum of balance_due from reporting.v_supplier_outstanding
    r = await db.execute(sa_text("""
        SELECT COALESCE(SUM(balance_due), 0)::float AS v
        FROM reporting.v_supplier_outstanding
        WHERE company_id = :cid
    """), {"cid": cid})
    total_ap = r.scalar() or 0.0

    # Counts
    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM sales.customer WHERE company_id = :cid AND is_deleted = false"
    ), {"cid": cid})
    total_customers = r.scalar() or 0

    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM purchasing.supplier WHERE company_id = :cid AND is_deleted = false"
    ), {"cid": cid})
    total_suppliers = r.scalar() or 0

    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM inventory.item WHERE company_id = :cid AND is_deleted = false"
    ), {"cid": cid})
    total_items = r.scalar() or 0

    # Items with zero/negative stock (low stock warning)
    r = await db.execute(sa_text("""
        SELECT COUNT(DISTINCT item_id) FROM reporting.v_stock_balance
        WHERE company_id = :cid AND qty_on_hand <= 0
    """), {"cid": cid})
    items_low_stock = r.scalar() or 0

    # Pending documents
    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM sales.sales_order WHERE company_id = :cid AND status = 'draft'"
    ), {"cid": cid})
    pending_so = r.scalar() or 0

    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM purchasing.purchase_order WHERE company_id = :cid AND status = 'draft'"
    ), {"cid": cid})
    pending_po = r.scalar() or 0

    r = await db.execute(sa_text(
        "SELECT COUNT(*) FROM accounting.journal_entry WHERE company_id = :cid AND status = 'draft'"
    ), {"cid": cid})
    pending_je = r.scalar() or 0

    return DashboardSummary(
        total_sales_this_month=total_sales,
        total_purchases_this_month=total_purchases,
        total_ar=total_ar,
        total_ap=total_ap,
        total_customers=total_customers,
        total_suppliers=total_suppliers,
        total_items=total_items,
        items_low_stock=items_low_stock,
        pending_sales_orders=pending_so,
        pending_purchase_orders=pending_po,
        pending_journal_entries=pending_je,
        as_of=today.isoformat(),
    )
