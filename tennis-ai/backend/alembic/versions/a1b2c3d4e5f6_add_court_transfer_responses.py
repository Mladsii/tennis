"""add court_transfer_responses table

Revision ID: a1b2c3d4e5f6
Revises: 8cc3183df573
Create Date: 2026-03-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8cc3183df573'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'court_transfer_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('court_transfer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('court_transfers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('responder_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('status', sa.String(10), nullable=False, server_default='pending', index=True),
        sa.Column('decline_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('court_transfer_id', 'responder_id', name='uq_court_transfer_responder'),
    )


def downgrade() -> None:
    op.drop_table('court_transfer_responses')
