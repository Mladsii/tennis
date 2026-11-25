"""search_requests: stm_min/stm_max range + gender_filter

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a6b7c8d9e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('search_requests', sa.Column('stm_min', sa.String(length=3), nullable=True))
    op.add_column('search_requests', sa.Column('stm_max', sa.String(length=3), nullable=True))
    op.add_column('search_requests', sa.Column('gender_filter', sa.String(length=1), nullable=True))


def downgrade() -> None:
    op.drop_column('search_requests', 'gender_filter')
    op.drop_column('search_requests', 'stm_max')
    op.drop_column('search_requests', 'stm_min')
