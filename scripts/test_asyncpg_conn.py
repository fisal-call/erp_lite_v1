"""Quick sanity check: can asyncpg connect with our DSN format?"""
import asyncio
import os
os.environ.setdefault("ERPLITE_DATABASE_URL",
    "postgresql+asyncpg://erplite_app:erplite_dev@/erplite?host=/home/z/my-project/pgdata")

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    e = create_async_engine(os.environ["ERPLITE_DATABASE_URL"], echo=False)
    async with e.connect() as conn:
        r = await conn.execute(text("SELECT current_user, current_database()"))
        print("OK:", r.first())
    await e.dispose()

asyncio.run(main())
