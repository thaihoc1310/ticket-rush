from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Wraps a page of results with total count for pagination."""

    items: list[T]
    total: int
