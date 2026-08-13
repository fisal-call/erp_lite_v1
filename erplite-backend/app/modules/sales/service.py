"""
app/modules/sales/service.py

Business logic lives here exclusively (AD-004: "Business Rules SHALL reside
primarily in the Python Service Layer"). Every check below traces back to a
Business Rule ID from ERP-002 PART 5 — this traceability is intentional and
should be preserved in every future service method across every module.

Cross-module dependency pattern: this service needs to resolve an Item's
internal id from its uuid (to build SalesOrderLine rows), but the `sales`
module must not import `inventory`'s repository directly (module boundary
rule, BACKEND_ARCHITECTURE.md §2). Instead it depends on a small Protocol
("port") that the composition root (main.py) wires to the real inventory
module's service ("adapter") once that module exists. This is the pattern
every other cross-module dependency in this system should follow.
"""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.modules.sales.models import Customer, SalesOrder, SalesOrderLine
from app.modules.sales.repository import CustomerRepository, SalesOrderRepository
from app.modules.sales.schemas import CustomerCreate, CustomerUpdate, SalesOrderCreate, SalesOrderRead, SalesOrderLineRead
from app.shared.document_numbering import next_document_number
from app.shared.schemas import UuidRef


class ItemLookupPort(Protocol):
    """Port implemented by the inventory module's service (adapter), injected at
    composition time. Keeps `sales` decoupled from `inventory`'s internals."""

    async def get_item_id_by_uuid(self, company_id: int, item_uuid: UUID) -> int | None: ...
    async def get_item_uuid_by_id(self, item_id: int) -> UUID | None: ...


class CustomerService:
    def __init__(self, repo: CustomerRepository):
        self.repo = repo

    async def create(self, *, company_id: int, created_by: int, data: CustomerCreate) -> Customer:
        # BR-PUR-013/BR-SAL-011 pattern: uniqueness enforced by the DB constraint
        # uq_customer__company_code; we still pre-check here to return a clean
        # 409 instead of surfacing a raw IntegrityError to the API caller.
        existing = await self.repo.get_by_code(company_id, data.customer_code)
        if existing is not None:
            raise BusinessRuleViolation(
                "BR-SAL-011-dup", f"Customer code '{data.customer_code}' already exists for this company."
            )

        customer = Customer(
            company_id=company_id,
            customer_code=data.customer_code,
            customer_name=data.customer_name,
            credit_limit=data.credit_limit,
            phone=data.phone,
            email=data.email,
            custom_fields=data.custom_fields,
            created_by=created_by,
            updated_by=created_by,
        )
        return await self.repo.add(customer)

    async def get(self, customer_uuid: UUID) -> Customer:
        customer = await self.repo.get_by_uuid(customer_uuid)
        if customer is None:
            raise NotFoundError("Customer", str(customer_uuid))
        return customer

    async def update(self, customer_uuid: UUID, *, updated_by: int, data: CustomerUpdate) -> Customer:
        customer = await self.get(customer_uuid)

        # PDR-001 Optimistic Locking: reject stale writes.
        if customer.version_no != data.expected_version_no:
            raise ConcurrencyConflict("Customer", str(customer_uuid))

        for field in ("customer_name", "credit_limit", "phone", "email", "is_active", "custom_fields"):
            value = getattr(data, field)
            if value is not None:
                setattr(customer, field, value)
        customer.version_no += 1
        customer.updated_by = updated_by
        await self.repo.flush()
        return customer


class CurrencyLookupPort(Protocol):
    async def get_currency_id_by_uuid(self, currency_uuid: UUID) -> int | None: ...


class SalesOrderService:
    def __init__(
        self,
        repo: SalesOrderRepository,
        customer_repo: CustomerRepository,
        item_lookup: ItemLookupPort,
        currency_lookup: CurrencyLookupPort,
    ):
        self.repo = repo
        self.customer_repo = customer_repo
        self.item_lookup = item_lookup
        self.currency_lookup = currency_lookup

    async def create(self, *, company_id: int, branch_id: int | None, created_by: int, data: SalesOrderCreate) -> SalesOrderRead:
        customer = await self.customer_repo.get_by_uuid(data.customer_uuid)
        if customer is None or customer.company_id != company_id:
            # BR-SAL-001: cannot approve/create an order without a valid customer.
            raise BusinessRuleViolation("BR-SAL-001", "A valid customer is required.")

        # BR-SAL-009: a suspended (is_active=false) customer cannot receive a new order.
        if not customer.is_active:
            raise BusinessRuleViolation("BR-SAL-009", f"Customer '{customer.customer_name}' is suspended.")

        # BR-SAL-002-family: at least one line (also enforced at the DTO level via min_length=1,
        # duplicated here because the Service Layer must never trust the transport layer alone).
        if not data.lines:
            raise BusinessRuleViolation("BR-SAL-001-lines", "A sales order must have at least one line.")

        document_number = await next_document_number(
            self.repo.session,
            company_id=company_id,
            doctype_name="SalesOrder",
            prefix="SO-",
        )

        currency_id = await self.currency_lookup.get_currency_id_by_uuid(data.currency_uuid)
        if currency_id is None:
            raise BusinessRuleViolation("CORE-001", f"Unknown currency {data.currency_uuid}.")

        order = SalesOrder(
            company_id=company_id,
            branch_id=branch_id,
            document_number=document_number,
            customer_id=customer.id,
            document_date=data.document_date,
            currency_id=currency_id,
            status="draft",
            custom_fields=data.custom_fields,
            created_by=created_by,
            updated_by=created_by,
        )

        for line_in in data.lines:
            item_id = await self.item_lookup.get_item_id_by_uuid(company_id, line_in.item_uuid)
            if item_id is None:
                raise BusinessRuleViolation(
                    "BR-SAL-001-item", f"Item {line_in.item_uuid} not found for this company."
                )
            order.lines.append(
                SalesOrderLine(item_id=item_id, qty_ordered=line_in.qty_ordered, rate=line_in.rate)
            )

        await self.repo.add(order)
        # Re-fetch with selectinload(customer, lines): an async session cannot
        # lazy-load relationships on attribute access after flush/commit — this
        # was caught via a real end-to-end HTTP test (MissingGreenlet error),
        # not by code review. Re-querying is the simplest correct fix.
        loaded_order = await self.repo.get_by_uuid_with_lines(order.uuid)
        assert loaded_order is not None  # just inserted in this same transaction
        return await self._to_read_dto(loaded_order)

    async def _to_read_dto(self, order: SalesOrder) -> SalesOrderRead:
        line_reads: list[SalesOrderLineRead] = []
        for line in order.lines:
            item_uuid = await self.item_lookup.get_item_uuid_by_id(line.item_id)
            line_reads.append(
                SalesOrderLineRead(item_uuid=item_uuid, qty_ordered=line.qty_ordered, rate=line.rate)
            )
        return SalesOrderRead(
            uuid=order.uuid,
            document_number=order.document_number,
            customer=UuidRef(uuid=order.customer.uuid),
            document_date=order.document_date,
            status=order.status,
            lines=line_reads,
            custom_fields=order.custom_fields,
            created_at=order.created_at,
            updated_at=order.updated_at,
            version_no=order.version_no,
        )

    async def get(self, order_uuid: UUID) -> SalesOrderRead:
        order = await self.repo.get_by_uuid_with_lines(order_uuid)
        if order is None:
            raise NotFoundError("SalesOrder", str(order_uuid))
        return await self._to_read_dto(order)

    async def submit(self, order_uuid: UUID, *, expected_version_no: int) -> SalesOrderRead:
        order = await self.repo.get_by_uuid_with_lines(order_uuid)
        if order is None:
            raise NotFoundError("SalesOrder", str(order_uuid))

        if order.version_no != expected_version_no:
            raise ConcurrencyConflict("SalesOrder", str(order_uuid))

        # BR-WF-003-style: only a draft can be submitted directly (no re-submitting a
        # cancelled/closed order). Full Workflow/Approval Matrix intentionally excluded
        # from ERP Lite scope — this is a simple, hardcoded draft->submitted transition.
        if order.status != "draft":
            raise BusinessRuleViolation(
                "BR-WF-003", f"Cannot submit a SalesOrder in status '{order.status}'."
            )

        order.status = "submitted"
        order.version_no += 1
        await self.repo.flush()
        return await self._to_read_dto(order)
