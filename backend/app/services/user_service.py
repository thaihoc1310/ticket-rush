from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate
from app.utils.security import hash_password


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, limit: int = 100, offset: int = 0) -> list[User]:
        stmt = select(User).order_by(User.created_at.desc(), User.id.asc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, user_id: UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return user

    async def create(self, data: UserCreate) -> User:
        existing = await self.db.scalar(select(User).where(User.email == data.email))
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            role=data.role,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user_id: UUID, data: UserUpdate) -> User:
        user = await self.get(user_id)
        payload = data.model_dump(exclude_unset=True)
        if "password" in payload and payload["password"]:
            user.password_hash = hash_password(payload.pop("password"))
        elif "password" in payload:
            payload.pop("password")
            
        # Delete old avatar file from disk when avatar URL changes
        if "avatar" in payload and user.avatar and user.avatar != payload["avatar"]:
            old_path = Path(user.avatar.lstrip("/"))
            if old_path.exists():
                old_path.unlink(missing_ok=True)
                
        for field, value in payload.items():
            setattr(user, field, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete(self, user_id: UUID) -> None:
        user = await self.get(user_id)
        await self.db.delete(user)
        await self.db.commit()
