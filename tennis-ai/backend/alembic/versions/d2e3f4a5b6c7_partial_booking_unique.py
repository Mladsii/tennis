"""booking: partial unique index for active slots only

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-28

Заменяем глобальный UniqueConstraint на частичный индекс WHERE status='active',
чтобы отменённые брони не мешали повторному бронированию того же слота.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Удаляем старый полный unique constraint
    op.drop_constraint('uq_court_booking_slot', 'court_bookings', type_='unique')

    # Создаём частичный уникальный индекс — только для активных броней
    op.execute(
        "CREATE UNIQUE INDEX uq_court_booking_active_slot "
        "ON court_bookings (court_id, date, slot_start) "
        "WHERE status = 'active'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_court_booking_active_slot")

    # Восстанавливаем полный unique (возможно, потребует очистки дублей)
    op.create_unique_constraint(
        'uq_court_booking_slot', 'court_bookings',
        ['court_id', 'date', 'slot_start']
    )
