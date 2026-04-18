from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.utils.enums import Gender, Role


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    date_of_birth: date | None = None
    gender: Gender | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    date_of_birth: date | None
    gender: Gender | None
    role: Role

    class Config:
        from_attributes = True
