"""
app/core/security.py
JWT issuing/verification and password hashing (Argon2, per ERP-001 §10).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# Argon2 chosen per ERP-001 §10 ("Argon2/bcrypt"). Never store or log raw passwords.
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(*, user_uuid: str, company_ids: list[int], tenant_id: int) -> str:
    """
    JWT payload carries company_ids (the set of core.company.id values the user
    is allowed to access, per security.user_company_access) and tenant_id.
    These two claims are exactly what RlsContext (see app/core/database.py)
    needs to populate the RLS session variables on every request.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": user_uuid,
        "company_ids": company_ids,
        "tenant_id": tenant_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class TokenPayload:
    __slots__ = ("user_uuid", "company_ids", "tenant_id")

    def __init__(self, user_uuid: str, company_ids: list[int], tenant_id: int):
        self.user_uuid = user_uuid
        self.company_ids = company_ids
        self.tenant_id = tenant_id


def decode_access_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc

    return TokenPayload(
        user_uuid=payload["sub"],
        company_ids=[int(c) for c in payload.get("company_ids", [])],
        tenant_id=int(payload.get("tenant_id", settings.default_tenant_id)),
    )
