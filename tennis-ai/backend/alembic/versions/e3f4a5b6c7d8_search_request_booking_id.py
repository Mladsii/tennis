"""search_requests: add booking_id FK to court_bookings

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-28

Добавляем поле booking_id (nullable FK → court_bookings.id SET NULL),
чтобы при создании запроса с court_booked=True можно было указать
конкретную бронь, и получатель видел название корта и время слота.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'search_requests',
        sa.Column(
            'booking_id',
            UUID(as_uuid=True),
            sa.ForeignKey('court_bookings.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_search_requests_booking_id',
        'search_requests',
        ['booking_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_search_requests_booking_id', table_name='search_requests')
    op.drop_column('search_requests', 'booking_id')
