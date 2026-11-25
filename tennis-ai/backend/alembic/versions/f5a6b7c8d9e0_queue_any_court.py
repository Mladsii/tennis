"""queue: any-court option (location_id + any_court flag)

Revision ID: f5a6b7c8d9e0
Revises: e3f4a5b6c7d8, f1e2d3c4b5a6
Create Date: 2026-07-01 15:50:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, tuple, None] = ('e3f4a5b6c7d8', 'f1e2d3c4b5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'waiting_queue',
        sa.Column('location_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'waiting_queue',
        sa.Column('any_court', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    op.create_index('ix_waiting_queue_location_id', 'waiting_queue', ['location_id'])
    op.create_index('ix_waiting_queue_any_court', 'waiting_queue', ['any_court'])
    op.create_foreign_key(
        'fk_waiting_queue_location_id',
        'waiting_queue',
        'locations',
        ['location_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('fk_waiting_queue_location_id', 'waiting_queue', type_='foreignkey')
    op.drop_index('ix_waiting_queue_any_court', table_name='waiting_queue')
    op.drop_index('ix_waiting_queue_location_id', table_name='waiting_queue')
    op.drop_column('waiting_queue', 'any_court')
    op.drop_column('waiting_queue', 'location_id')
