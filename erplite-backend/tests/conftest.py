"""
tests/conftest.py
Shared pytest fixtures for the ERP-LITE test suite.

The session-scoped event_loop fixture is required because asyncpg's connection
pool binds connections to the event loop that created them. With pytest-asyncio's
default function-scoped loop, each test gets a new loop but the global
AsyncSessionLocal engine (created once at import time in app/core/database.py)
still holds connections from the first loop — causing "attached to a different
loop" RuntimeErrors when multiple async tests run in the same session.
"""
import asyncio

import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop — all async tests in the session share it.

    Required because the global AsyncSessionLocal engine binds connections
    to whichever event loop first uses it; all tests must use that same loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
