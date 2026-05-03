"""move grid dimensions to venues

Revision ID: c9f5e68d6b2a
Revises: 5e0531ce052a
Create Date: 2026-05-03 00:00:00.000000

"""
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision: str = "c9f5e68d6b2a"
down_revision: str | None = "5e0531ce052a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column("venues", sa.Column("grid_rows", sa.Integer(), nullable=True))
    op.add_column("venues", sa.Column("grid_cols", sa.Integer(), nullable=True))

    rows = bind.execute(
        sa.text(
            """
            SELECT
                v.id AS venue_id,
                COALESCE(MAX(GREATEST(e.grid_rows, COALESCE(sb.max_row, 0))), 10)
                    AS grid_rows,
                COALESCE(MAX(GREATEST(e.grid_cols, COALESCE(sb.max_col, 0))), 15)
                    AS grid_cols
            FROM venues v
            LEFT JOIN events e ON e.venue_id = v.id
            LEFT JOIN (
                SELECT event_id, MAX(row_number) AS max_row, MAX(seat_number) AS max_col
                FROM seats
                GROUP BY event_id
            ) sb ON sb.event_id = e.id
            GROUP BY v.id
            """
        )
    ).mappings()
    for row in rows:
        bind.execute(
            sa.text(
                """
                UPDATE venues
                SET grid_rows = :grid_rows, grid_cols = :grid_cols
                WHERE id = :venue_id
                """
            ),
            {
                "venue_id": row["venue_id"],
                "grid_rows": row["grid_rows"],
                "grid_cols": row["grid_cols"],
            },
        )

    op.alter_column("venues", "grid_rows", existing_type=sa.Integer(), nullable=False)
    op.alter_column("venues", "grid_cols", existing_type=sa.Integer(), nullable=False)

    events = bind.execute(
        sa.text(
            """
            SELECT e.id AS event_id, v.grid_rows, v.grid_cols
            FROM events e
            JOIN venues v ON v.id = e.venue_id
            """
        )
    ).mappings()
    for event in events:
        existing = {
            (row_number, seat_number)
            for row_number, seat_number in bind.execute(
                sa.text(
                    """
                    SELECT row_number, seat_number
                    FROM seats
                    WHERE event_id = :event_id
                    """
                ),
                {"event_id": event["event_id"]},
            ).all()
        }
        missing = [
            {
                "id": uuid4(),
                "event_id": event["event_id"],
                "row_number": row,
                "seat_number": col,
            }
            for row in range(1, event["grid_rows"] + 1)
            for col in range(1, event["grid_cols"] + 1)
            if (row, col) not in existing
        ]
        if missing:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO seats (
                        id, event_id, zone_id, row_number, seat_number, status
                    )
                    VALUES (
                        :id, :event_id, NULL, :row_number, :seat_number,
                        'AVAILABLE'::seat_status_enum
                    )
                    """
                ),
                missing,
            )

    op.drop_column("events", "grid_cols")
    op.drop_column("events", "grid_rows")
    op.drop_column("venues", "capacity")


def downgrade() -> None:
    bind = op.get_bind()

    op.add_column(
        "venues",
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("events", sa.Column("grid_rows", sa.Integer(), nullable=True))
    op.add_column("events", sa.Column("grid_cols", sa.Integer(), nullable=True))

    bind.execute(
        sa.text(
            """
            UPDATE events e
            SET grid_rows = v.grid_rows,
                grid_cols = v.grid_cols
            FROM venues v
            WHERE v.id = e.venue_id
            """
        )
    )

    op.alter_column("events", "grid_rows", existing_type=sa.Integer(), nullable=False)
    op.alter_column("events", "grid_cols", existing_type=sa.Integer(), nullable=False)
    op.alter_column("venues", "capacity", server_default=None)
    op.drop_column("venues", "grid_cols")
    op.drop_column("venues", "grid_rows")
