"""add_max_tickets_per_user_to_events

Revision ID: a1b2c3d4e5f6
Revises: c9f5e68d6b2a
Create Date: 2026-05-13 22:15:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c9f5e68d6b2a'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "max_tickets_per_user",
            sa.Integer(),
            nullable=False,
            server_default="8",
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "max_tickets_per_user")
