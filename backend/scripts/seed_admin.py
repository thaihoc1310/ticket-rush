"""Create an admin user.

Usage:
    uv run python -m scripts.seed_admin admin@example.com password123 "Admin User"
"""

import asyncio
import sys

from sqlalchemy import select

from app.database import async_session_maker
from app.models.user import User
from app.utils.enums import Role
from app.utils.security import hash_password


async def main(email: str, password: str, full_name: str) -> None:
    async with async_session_maker() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            existing.role = Role.ADMIN
            existing.password_hash = hash_password(password)
            await db.commit()
            print(f"Updated existing user {email} to ADMIN")
            return
        admin = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=Role.ADMIN,
        )
        db.add(admin)
        await db.commit()
        print(f"Created admin {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: seed_admin.py <email> <password> <full_name>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
