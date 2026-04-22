from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.event import EventImageOut
from app.services.upload_service import UploadService

router = APIRouter(prefix="/api", tags=["uploads"])


@router.post("/upload/avatar", response_model=dict)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    url = await UploadService(db).upload_avatar(user.id, file)
    return {"avatar_url": url}


@router.post(
    "/upload/avatar/{user_id}",
    response_model=dict,
    dependencies=[Depends(require_admin)],
)
async def admin_upload_avatar(
    user_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    url = await UploadService(db).upload_avatar(user_id, file)
    return {"avatar_url": url}


@router.post(
    "/upload/event-images/{event_id}",
    response_model=list[EventImageOut],
    dependencies=[Depends(require_admin)],
)
async def upload_event_images(
    event_id: UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    return await UploadService(db).upload_event_images(event_id, files)


@router.delete(
    "/event-images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_event_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await UploadService(db).delete_event_image(image_id)


@router.patch(
    "/event-images/{image_id}/set-main",
    response_model=EventImageOut,
    dependencies=[Depends(require_admin)],
)
async def set_main_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await UploadService(db).set_main_image(image_id)
