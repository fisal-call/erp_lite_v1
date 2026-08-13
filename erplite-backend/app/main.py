"""
app/main.py
Application composition root: assembles the FastAPI app from each module's router.
Adding a new module = one import + one include_router line here, nothing else.

CORS:
    In development the Vite dev server runs on http://127.0.0.1:5173 while the
    API runs on http://127.0.0.1:8000 — two different origins, so the browser
    will block every request without an explicit CORS policy. We add a
    permissive middleware in development only. Production deployments are
    expected to be served from the same origin (or behind a reverse proxy that
    strips Origin/sets Access-Control-Allow-Origin explicitly).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.accounting.router import router as accounting_router
from app.modules.cost_centers.router import router as cost_centers_router
from app.modules.core_org.router import router as core_org_router
from app.modules.inventory.router import router as inventory_router
from app.modules.purchasing.router import router as purchasing_router
from app.modules.reporting.router import router as reporting_router
from app.modules.reporting.extended_router import router as reporting_extended_router
from app.modules.sales.router import router as sales_router
from app.modules.security.router import router as security_router

settings = get_settings()

app = FastAPI(
    title="ERP Lite API",
    version="1.0.0",
    description="ERP-Lite v1.0 — security, core_org, inventory, purchasing, sales, accounting, cost_centers, reporting.",
)

# CORS — only enabled when environment == development. In production we assume
# the frontend is served from the same origin as the API (or via a reverse
# proxy), so cross-origin access is not needed and should not be permitted.
if settings.environment == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(security_router, prefix=settings.api_v1_prefix)
app.include_router(core_org_router, prefix=settings.api_v1_prefix)
app.include_router(inventory_router, prefix=settings.api_v1_prefix)
app.include_router(purchasing_router, prefix=settings.api_v1_prefix)
app.include_router(sales_router, prefix=settings.api_v1_prefix)
app.include_router(accounting_router, prefix=settings.api_v1_prefix)
app.include_router(cost_centers_router, prefix=settings.api_v1_prefix)
app.include_router(reporting_router, prefix=settings.api_v1_prefix)
app.include_router(reporting_extended_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Unauthenticated liveness probe only — no DB call (a DB-down health check
    belongs in a separate /health/db endpoint once deployment tooling needs it)."""
    return {"status": "ok"}
