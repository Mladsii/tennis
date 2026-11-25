"""sprint2: add open_date to search_requests, price_per_slot to courts

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-14 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "search_requests",
        sa.Column("open_date", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "courts",
        sa.Column("price_per_slot", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("search_requests", "open_date")
    op.drop_column("courts", "price_per_slot")
