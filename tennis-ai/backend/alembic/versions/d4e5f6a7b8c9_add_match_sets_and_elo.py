"""add match_sets table and users.elo_rating

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-24 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('elo_rating', sa.SmallInteger(), nullable=False, server_default='1500'),
    )
    op.create_index(op.f('ix_users_elo_rating'), 'users', ['elo_rating'], unique=False)

    op.create_table(
        'match_sets',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('creator_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('opponent_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('played_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('creator_games', sa.SmallInteger(), nullable=False),
        sa.Column('opponent_games', sa.SmallInteger(), nullable=False),
        sa.Column('creator_tiebreak', sa.SmallInteger(), nullable=True),
        sa.Column('opponent_tiebreak', sa.SmallInteger(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('photo_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='pending'),
        sa.Column('decline_reason', sa.Text(), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('creator_elo_before', sa.SmallInteger(), nullable=True),
        sa.Column('opponent_elo_before', sa.SmallInteger(), nullable=True),
        sa.Column('creator_elo_change', sa.SmallInteger(), nullable=True),
        sa.Column('opponent_elo_change', sa.SmallInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['opponent_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_match_sets_creator_id'), 'match_sets', ['creator_id'], unique=False)
    op.create_index(op.f('ix_match_sets_opponent_id'), 'match_sets', ['opponent_id'], unique=False)
    op.create_index(op.f('ix_match_sets_played_at'), 'match_sets', ['played_at'], unique=False)
    op.create_index(op.f('ix_match_sets_status'), 'match_sets', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_match_sets_status'), table_name='match_sets')
    op.drop_index(op.f('ix_match_sets_played_at'), table_name='match_sets')
    op.drop_index(op.f('ix_match_sets_opponent_id'), table_name='match_sets')
    op.drop_index(op.f('ix_match_sets_creator_id'), table_name='match_sets')
    op.drop_table('match_sets')
    op.drop_index(op.f('ix_users_elo_rating'), table_name='users')
    op.drop_column('users', 'elo_rating')
