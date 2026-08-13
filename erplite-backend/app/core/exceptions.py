"""
app/core/exceptions.py
Domain-level exceptions, translated to HTTP responses in main.py's exception handlers.
Keeping these framework-agnostic keeps the Service Layer (AD-004) independent of FastAPI.
"""


class DomainError(Exception):
    """Base class for all business-rule violations raised from the Service Layer."""


class NotFoundError(DomainError):
    def __init__(self, entity: str, identifier: str):
        super().__init__(f"{entity} not found: {identifier}")
        self.entity = entity
        self.identifier = identifier


class BusinessRuleViolation(DomainError):
    """Raised when a Service Layer check fails a documented Business Rule (ERP-002 PART 5).
    Always carries the Rule ID so the API response can point back to the specification."""

    def __init__(self, rule_id: str, message: str):
        super().__init__(f"[{rule_id}] {message}")
        self.rule_id = rule_id


class ConcurrencyConflict(DomainError):
    """Raised when an update's version_no does not match the current row (PDR-001
    Optimistic Locking) — the caller is working from stale data."""

    def __init__(self, entity: str, identifier: str):
        super().__init__(f"{entity} {identifier} was modified by another user — reload and retry.")
