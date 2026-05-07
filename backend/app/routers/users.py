from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.auth import UserCreate, UserOut, UserUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.user_service import UserService
from app.utils.enums import Gender, Role

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=PaginatedResponse[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, description="Search name or email"),
    roles: str | None = Query(default=None, description="Comma-separated roles"),
    genders: str | None = Query(default=None, description="Comma-separated genders"),
    sort: str = Query(default="created_at", description="Sort field"),
    order: str = Query(default="desc", regex="^(asc|desc)$"),
    limit: int = Query(default=10, ge=1, le=200, alias="size"),
    offset: int = Query(default=0, ge=0),
    page: int | None = Query(default=None, ge=1),
):
    if page is not None:
        offset = (page - 1) * limit

    role_list = [Role(r.strip()) for r in roles.split(",") if r.strip()] if roles else None
    gender_list = [Gender(g.strip()) for g in genders.split(",") if g.strip()] if genders else None

    items, total = await UserService(db).list(
        search=q,
        roles=role_list,
        genders=gender_list,
        sort_by=sort,
        sort_order=order,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(items=items, total=total)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    return await UserService(db).get(user_id)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    return await UserService(db).create(data)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID, data: UserUpdate, db: AsyncSession = Depends(get_db)
):
    return await UserService(db).update(user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    await UserService(db).delete(user_id)
