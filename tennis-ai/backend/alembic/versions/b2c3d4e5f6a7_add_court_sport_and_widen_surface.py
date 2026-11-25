"""add sport column to courts and widen surface_type

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'courts',
        sa.Column('sport', sa.String(length=10), nullable=False, server_default='tennis'),
    )
    op.create_index(op.f('ix_courts_sport'), 'courts', ['sport'], unique=False)
    op.alter_column(
        'courts',
        'surface_type',
        existing_type=sa.String(length=10),
        type_=sa.String(length=20),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'courts',
        'surface_type',
        existing_type=sa.String(length=20),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
    op.drop_index(op.f('ix_courts_sport'), table_name='courts')
    op.drop_column('courts', 'sport')
