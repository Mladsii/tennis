"""booking: payment_status, periodic fields, slot_locks table

Revision ID: c1d2e3f4a5b6
Revises: b8c9d0e1f2a3
Create Date: 2026-05-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── CourtBooking: статус оплаты ──────────────────────────────
    op.add_column('court_bookings',
        sa.Column('payment_status', sa.String(10), nullable=False, server_default='unpaid'))

    # ── CourtBooking: периодическая бронь ────────────────────────
    op.add_column('court_bookings',
        sa.Column('is_periodic', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('court_bookings',
        sa.Column('day_of_week', sa.SmallInteger(), nullable=True))
    op.add_column('court_bookings',
        sa.Column('valid_until', sa.Date(), nullable=True))
    op.add_column('court_bookings',
        sa.Column('recurring_group_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_court_bookings_recurring_group_id',
        'court_bookings', ['recurring_group_id'])

    # ── slot_locks: 7-мин блокировка ячейки ─────────────────────
    op.create_table(
        'slot_locks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('court_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('slot_start', sa.Time(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['court_id'], ['courts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('court_id', 'date', 'slot_start', name='uq_slot_lock'),
    )
    op.create_index('ix_slot_locks_court_id', 'slot_locks', ['court_id'])
    op.create_index('ix_slot_locks_user_id', 'slot_locks', ['user_id'])
    op.create_index('ix_slot_locks_date', 'slot_locks', ['date'])
    op.create_index('ix_slot_locks_expires_at', 'slot_locks', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_slot_locks_expires_at', 'slot_locks')
    op.drop_index('ix_slot_locks_date', 'slot_locks')
    op.drop_index('ix_slot_locks_user_id', 'slot_locks')
    op.drop_index('ix_slot_locks_court_id', 'slot_locks')
    op.drop_table('slot_locks')

    op.drop_index('ix_court_bookings_recurring_group_id', 'court_bookings')
    op.drop_column('court_bookings', 'recurring_group_id')
    op.drop_column('court_bookings', 'valid_until')
    op.drop_column('court_bookings', 'day_of_week')
    op.drop_column('court_bookings', 'is_periodic')
    op.drop_column('court_bookings', 'payment_status')
