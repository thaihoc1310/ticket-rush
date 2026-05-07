from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate
from app.utils.enums import Gender, Role
from app.utils.security import hash_password


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        *,
        search: str | None = None,
        roles: list[Role] | None = None,
        genders: list[Gender] | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int = 10,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        stmt = select(User)

        # Text search
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                )
            )

        # Role filter
        if roles:
            stmt = stmt.where(User.role.in_(roles))

        # Gender filter
        if genders:
            stmt = stmt.where(User.gender.in_(genders))

        # Count before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0

        # Sorting
        allowed_sorts = {"full_name", "email", "role", "gender", "created_at"}
        col_name = sort_by if sort_by in allowed_sorts else "created_at"
        col = getattr(User, col_name)
        stmt = stmt.order_by(col.desc() if sort_order == "desc" else col.asc(), User.id.asc())

        # Pagination
        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

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
