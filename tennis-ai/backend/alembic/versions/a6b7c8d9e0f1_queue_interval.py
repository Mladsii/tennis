"""queue: interval-based entries (slot_end, min_duration, accept_partial)

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-07-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('waiting_queue', sa.Column('slot_end', sa.Time(), nullable=True))
    op.add_column(
        'waiting_queue',
        sa.Column('min_duration', sa.Integer(), server_default='60', nullable=False),
    )
    op.add_column(
        'waiting_queue',
        sa.Column('accept_partial', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    # Старые записи: интервал = один слот 30 минут, min_duration 30 (не ломать поведение)
    op.execute(
        "UPDATE waiting_queue SET slot_end = slot_start + interval '30 minutes', min_duration = 30 "
        "WHERE slot_end IS NULL"
    )


def downgrade() -> None:
    op.drop_column('waiting_queue', 'accept_partial')
    op.drop_column('waiting_queue', 'min_duration')
    op.drop_column('waiting_queue', 'slot_end')
