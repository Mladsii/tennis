"""add conversations and messages tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-26 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_a_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_b_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_a_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_b_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_conversations_user_a_id'), 'conversations', ['user_a_id'])
    op.create_index(op.f('ix_conversations_user_b_id'), 'conversations', ['user_b_id'])
    op.create_index(op.f('ix_conversations_last_message_at'), 'conversations', ['last_message_at'])
    op.create_index('ix_conversations_pair', 'conversations', ['user_a_id', 'user_b_id'], unique=True)

    op.create_table(
        'messages',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'])
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'])
    op.create_index(op.f('ix_messages_is_read'), 'messages', ['is_read'])
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'])


def downgrade() -> None:
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_is_read'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_table('messages')
    op.drop_index('ix_conversations_pair', table_name='conversations')
    op.drop_index(op.f('ix_conversations_last_message_at'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_user_b_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_user_a_id'), table_name='conversations')
    op.drop_table('conversations')
