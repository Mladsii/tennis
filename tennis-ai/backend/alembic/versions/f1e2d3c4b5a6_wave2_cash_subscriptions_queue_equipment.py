"""wave2: cash, subscriptions, queue, equipment

Revision ID: f1e2d3c4b5a6
Revises: 462fda20c93c
Create Date: 2026-05-04 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = '462fda20c93c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── cash_sessions ──────────────────────────────────────────────────────────
    op.create_table(
        'cash_sessions',
        sa.Column('opened_by_id', sa.UUID(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='open'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['opened_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cash_sessions_status', 'cash_sessions', ['status'])
    op.create_index('ix_cash_sessions_opened_by_id', 'cash_sessions', ['opened_by_id'])

    # ── cash_transactions ──────────────────────────────────────────────────────
    op.create_table(
        'cash_transactions',
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('payment_type', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='completed'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['cash_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['booking_id'], ['court_bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cash_transactions_session_id', 'cash_transactions', ['session_id'])
    op.create_index('ix_cash_transactions_payment_type', 'cash_transactions', ['payment_type'])
    op.create_index('ix_cash_transactions_status', 'cash_transactions', ['status'])

    # ── subscription_plans ─────────────────────────────────────────────────────
    op.create_table(
        'subscription_plans',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('hours_total', sa.Integer(), nullable=False),
        sa.Column('validity_days', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subscription_plans_is_active', 'subscription_plans', ['is_active'])

    # ── user_subscriptions ─────────────────────────────────────────────────────
    op.create_table(
        'user_subscriptions',
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('sold_by_id', sa.UUID(), nullable=True),
        sa.Column('hours_remaining', sa.Numeric(8, 2), nullable=False),
        sa.Column('purchased_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='active'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['subscription_plans.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sold_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_subscriptions_user_id', 'user_subscriptions', ['user_id'])
    op.create_index('ix_user_subscriptions_status', 'user_subscriptions', ['status'])
    op.create_index('ix_user_subscriptions_expires_at', 'user_subscriptions', ['expires_at'])

    # ── waiting_queue ──────────────────────────────────────────────────────────
    op.create_table(
        'waiting_queue',
        sa.Column('court_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('slot_start', sa.Time(), nullable=False),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='waiting'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['court_id'], ['courts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_waiting_queue_court_id', 'waiting_queue', ['court_id'])
    op.create_index('ix_waiting_queue_date', 'waiting_queue', ['date'])
    op.create_index('ix_waiting_queue_status', 'waiting_queue', ['status'])

    # ── equipment ──────────────────────────────────────────────────────────────
    op.create_table(
        'equipment',
        sa.Column('location_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('equipment_type', sa.String(length=20), nullable=False),
        sa.Column('quantity_total', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('quantity_available', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('price_per_hour', sa.Numeric(8, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_equipment_location_id', 'equipment', ['location_id'])
    op.create_index('ix_equipment_equipment_type', 'equipment', ['equipment_type'])

    # ── equipment_rentals ──────────────────────────────────────────────────────
    op.create_table(
        'equipment_rentals',
        sa.Column('equipment_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('rented_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('returned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='active'),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['booking_id'], ['court_bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_equipment_rentals_equipment_id', 'equipment_rentals', ['equipment_id'])
    op.create_index('ix_equipment_rentals_status', 'equipment_rentals', ['status'])


def downgrade() -> None:
    op.drop_table('equipment_rentals')
    op.drop_table('equipment')
    op.drop_table('waiting_queue')
    op.drop_table('user_subscriptions')
    op.drop_table('subscription_plans')
    op.drop_table('cash_transactions')
    op.drop_table('cash_sessions')
