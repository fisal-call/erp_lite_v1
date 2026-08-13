"""
app/modules/purchasing/service.py
Mirrors sales/service.py structure. Every check traces to a Business Rule ID (ERP-002 PART 5).
"""
from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.core.exceptions import BusinessRuleViolation, ConcurrencyConflict, NotFoundError
from app.modules.purchasing.models import PurchaseOrder, PurchaseOrderLine, Supplier
from app.modules.purchasing.repository import PurchaseOrderRepository, SupplierRepository
from app.modules.purchasing.schemas import PurchaseOrderCreate, PurchaseOrderLineRead, PurchaseOrderRead, SupplierCreate, SupplierUpdate
from app.shared.document_numbering import next_document_number
from app.shared.schemas import UuidRef


class ItemLookupPort(Protocol):
    async def get_item_id_by_uuid(self, company_id: int, item_uuid: UUID) -> int | None: ...
    async def get_item_uuid_by_id(self, item_id: int) -> UUID | None: ...


class CurrencyLookupPort(Protocol):
    async def get_currency_id_by_uuid(self, currency_uuid: UUID) -> int | None: ...


class SupplierService:
    def __init__(self, repo: SupplierRepository):
        self.repo = repo

    async def create(self, *, company_id: int, created_by: int, data: SupplierCreate) -> Supplier:
        if await self.repo.get_by_code(company_id, data.supplier_code) is not None:
            # BD-010 (same permanent-reservation policy as Customer/Item codes)
            raise BusinessRuleViolation("BD-010", f"Supplier code '{data.supplier_code}' already exists.")
        supplier = Supplier(
            company_id=company_id,
            supplier_code=data.supplier_code,
            supplier_name=data.supplier_name,
            phone=data.phone,
            email=data.email,
            custom_fields=data.custom_fields,
            created_by=created_by,
            updated_by=created_by,
        )
        return await self.repo.add(supplier)

    async def get(self, supplier_uuid: UUID) -> Supplier:
        supplier = await self.repo.get_by_uuid(supplier_uuid)
        if supplier is None:
            raise NotFoundError("Supplier", str(supplier_uuid))
        return supplier

    async def update(self, supplier_uuid: UUID, *, updated_by: int, data: SupplierUpdate) -> Supplier:
        supplier = await self.get(supplier_uuid)

        # PDR-001 Optimistic Locking: reject stale writes.
        if supplier.version_no != data.expected_version_no:
            raise ConcurrencyConflict("Supplier", str(supplier_uuid))

        for field in ("supplier_name", "phone", "email", "is_active", "custom_fields"):
            value = getattr(data, field)
            if value is not None:
                setattr(supplier, field, value)
        supplier.version_no += 1
        supplier.updated_by = updated_by
        await self.repo.flush()
        return supplier


class PurchaseOrderService:
    def __init__(
        self,
        repo: PurchaseOrderRepository,
        supplier_repo: SupplierRepository,
        item_lookup: ItemLookupPort,
        currency_lookup: CurrencyLookupPort,
    ):
        self.repo = repo
        self.supplier_repo = supplier_repo
        self.item_lookup = item_lookup
        self.currency_lookup = currency_lookup

    async def create(self, *, company_id: int, branch_id: int | None, created_by: int, data: PurchaseOrderCreate) -> PurchaseOrderRead:
        supplier = await self.supplier_repo.get_by_uuid(data.supplier_uuid)
        if supplier is None or supplier.company_id != company_id:
            raise BusinessRuleViolation("BR-PUR-001", "A valid supplier is required.")

        # BR-PUR-010: a blacklisted (is_active=false) supplier cannot receive a new order.
        if not supplier.is_active:
            raise BusinessRuleViolation("BR-PUR-010", f"Supplier '{supplier.supplier_name}' is blacklisted.")

        if not data.lines:
            raise BusinessRuleViolation("BR-PUR-002", "A purchase order must have at least one line.")

        currency_id = await self.currency_lookup.get_currency_id_by_uuid(data.currency_uuid)
        if currency_id is None:
            raise BusinessRuleViolation("CORE-001", f"Unknown currency {data.currency_uuid}.")

        document_number = await next_document_number(
            self.repo.session, company_id=company_id, doctype_name="PurchaseOrder", prefix="PO-"
        )

        order = PurchaseOrder(
            company_id=company_id,
            branch_id=branch_id,
            document_number=document_number,
            supplier_id=supplier.id,
            document_date=data.document_date,
            currency_id=currency_id,
            status="draft",
            custom_fields=data.custom_fields,
            created_by=created_by,
        )
        for line_in in data.lines:
            item_id = await self.item_lookup.get_item_id_by_uuid(company_id, line_in.item_uuid)
            if item_id is None:
                raise BusinessRuleViolation("BR-PUR-012", f"Item {line_in.item_uuid} not found for this company.")
            order.lines.append(
                PurchaseOrderLine(item_id=item_id, qty_ordered=line_in.qty_ordered, rate=line_in.rate)
            )

        await self.repo.add(order)
        loaded = await self.repo.get_by_uuid_with_lines(order.uuid)
        assert loaded is not None
        return await self._to_read_dto(loaded)

    async def _to_read_dto(self, order: PurchaseOrder) -> PurchaseOrderRead:
        line_reads: list[PurchaseOrderLineRead] = []
        for line in order.lines:
            item_uuid = await self.item_lookup.get_item_uuid_by_id(line.item_id)
            line_reads.append(PurchaseOrderLineRead(item_uuid=item_uuid, qty_ordered=line.qty_ordered, rate=line.rate))
        return PurchaseOrderRead(
            uuid=order.uuid,
            document_number=order.document_number,
            supplier=UuidRef(uuid=order.supplier.uuid),
            document_date=order.document_date,
            status=order.status,
            lines=line_reads,
            custom_fields=order.custom_fields,
            created_at=order.created_at,
            updated_at=None,
            version_no=order.version_no,
        )

    async def get(self, order_uuid: UUID) -> PurchaseOrderRead:
        order = await self.repo.get_by_uuid_with_lines(order_uuid)
        if order is None:
            raise NotFoundError("PurchaseOrder", str(order_uuid))
        return await self._to_read_dto(order)

    async def submit(self, order_uuid: UUID, *, expected_version_no: int) -> PurchaseOrderRead:
        order = await self.repo.get_by_uuid_with_lines(order_uuid)
        if order is None:
            raise NotFoundError("PurchaseOrder", str(order_uuid))
        if order.version_no != expected_version_no:
            raise ConcurrencyConflict("PurchaseOrder", str(order_uuid))
        if order.status != "draft":
            raise BusinessRuleViolation("BR-WF-003", f"Cannot submit a PurchaseOrder in status '{order.status}'.")
        order.status = "submitted"
        order.version_no += 1
        await self.repo.flush()
        return await self._to_read_dto(order)
