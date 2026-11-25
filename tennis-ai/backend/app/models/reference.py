from sqlalchemy import SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NtrpStmLevel(Base):
    __tablename__ = "ntrp_stm_levels"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    ntrp: Mapped[str] = mapped_column(String(10), unique=True)
    stm: Mapped[str] = mapped_column(String(3), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger)
