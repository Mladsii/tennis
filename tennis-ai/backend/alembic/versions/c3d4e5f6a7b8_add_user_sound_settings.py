"""add sound settings to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-24 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('sound_on_search', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('sound_on_booking', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('sound_on_player_request', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column('users', 'sound_on_player_request')
    op.drop_column('users', 'sound_on_booking')
    op.drop_column('users', 'sound_on_search')
