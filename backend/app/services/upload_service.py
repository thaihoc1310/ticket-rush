import os
import shutil
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.event_image import EventImage
from app.models.user import User

UPLOAD_DIR = Path("uploads")
AVATAR_DIR = UPLOAD_DIR / "avatars"
EVENT_IMAGE_DIR = UPLOAD_DIR / "events"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _ensure_dirs() -> None:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    EVENT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def _validate_image(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type: {file.content_type}",
        )


def _save_file(file: UploadFile, dest_dir: Path) -> str:
    _ensure_dirs()
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    filename = f"{uuid4().hex}{ext}"
    dest = dest_dir / filename
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)
    return f"/uploads/{dest.relative_to(UPLOAD_DIR)}"


class UploadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload_avatar_file(self, file: UploadFile) -> str:
        """Validate and save avatar file to disk. Does NOT update the user record."""
        _validate_image(file)
        return _save_file(file, AVATAR_DIR)

    async def upload_avatar(self, user_id: UUID, file: UploadFile) -> str:
        """Upload avatar AND persist to user record (used by admin endpoint)."""
        _validate_image(file)
        user = await self.db.get(User, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        url = _save_file(file, AVATAR_DIR)
        if user.avatar:
            old_path = Path(user.avatar.lstrip("/"))
            if old_path.exists():
                old_path.unlink(missing_ok=True)
        user.avatar = url
        await self.db.commit()
        await self.db.refresh(user)
        return url

    async def upload_event_images(
        self, event_id: UUID, files: list[UploadFile]
    ) -> list[EventImage]:
        event = await self.db.get(Event, event_id)
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

        # Get current max display_order
        stmt = (
            select(EventImage.display_order)
            .where(EventImage.event_id == event_id)
            .order_by(EventImage.display_order.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        max_order = result.scalar() or 0

        images: list[EventImage] = []
        for i, file in enumerate(files):
            _validate_image(file)
            event_dir = EVENT_IMAGE_DIR / str(event_id)
            event_dir.mkdir(parents=True, exist_ok=True)
            url = _save_file(file, event_dir)
            # First image uploaded is_main if no images exist
            is_first = max_order == 0 and i == 0
            img = EventImage(
                event_id=event_id,
                image_url=url,
                is_main=is_first and len(images) == 0,
                display_order=max_order + i + 1,
            )
            self.db.add(img)
            images.append(img)

        await self.db.commit()
        for img in images:
            await self.db.refresh(img)
        return images

    async def delete_event_image(self, image_id: UUID) -> None:
        img = await self.db.get(EventImage, image_id)
        if img is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
        # Remove physical file
        file_path = Path(img.image_url.lstrip("/"))
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        await self.db.delete(img)
        await self.db.commit()

    async def set_main_image(self, image_id: UUID) -> EventImage:
        img = await self.db.get(EventImage, image_id)
        if img is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
        # Unset all main images for this event
        await self.db.execute(
            update(EventImage)
            .where(EventImage.event_id == img.event_id)
            .values(is_main=False)
        )
        img.is_main = True
        await self.db.commit()
        await self.db.refresh(img)
        return img
