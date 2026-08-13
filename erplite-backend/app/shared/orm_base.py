"""
app/shared/orm_base.py
Single declarative base shared by every module's models.py, so all mapped
classes share one metadata registry (required by SQLAlchemy) — this does NOT
mean modules import each other's models; each module only maps the tables it
owns, matching the schema ownership boundaries in ERP-004 §1/Data Ownership.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
