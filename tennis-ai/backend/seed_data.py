"""Seed reference data and test users into the database."""
import asyncio
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.reference import NtrpStmLevel
from app.models.user import User
from app.utils.security import hash_password

NTRP_STM_DATA = [
    ("1.0", "1", "Этот игрок только начинает играть в теннис", 1),
    ("1.5", "2", "Имеет начальные навыки игры, работает над удержанием мяча в пределах корта", 2),
    ("2.0", "3", "Не хватает игрового опыта, очевидные недостатки во всех ударах", 3),
    ("2.5", "4", "Учится предугадывать направление мяча, слабое чувство корта", 4),
    ("3.0", "5", "Успешно отбивает мячи средней сложности, неуверен в контроле", 5),
    ("3.5", "6", "Хороший контроль за направлением мячей умеренной сложности", 6),
    ("4.0", "7", "Хорошо контролирует направление и глубину ударов средней сложности", 7),
    ("4.5", "8", "Использует силу удара и подкрутки, контролирует темп игры", 8),
    ("5.0", "9", "Хорошее чувство мяча, выдающийся удар, уверенная игра на задней линии", 9),
    ("5.5", "10", "Развитая сила ударов и постоянство, варьирует стратегию", 10),
    ("6.0-7.0", "pro", "Профессиональный уровень, участие в национальных и международных турнирах", 11),
]

TEST_USERS = [
    dict(
        last_name="Иванова",    first_name="Алиса",   patronymic=None,
        nickname="alice",       phone_primary="+70001110001", password="Alice1234",
        gender="F", date_of_birth=date(1995, 3, 12),
        city="Москва",          years_playing=5,
        ntrp_level="3.5",       stm_level="6",
        is_admin=True,
    ),
    dict(
        last_name="Борисов",    first_name="Борис",   patronymic=None,
        nickname="boris",       phone_primary="+70001110002", password="Boris1234",
        gender="M", date_of_birth=date(1992, 7, 24),
        city="Москва",          years_playing=8,
        ntrp_level="4.0",       stm_level="7",
        is_admin=False,
    ),
    dict(
        last_name="Карпова",    first_name="Карина",  patronymic=None,
        nickname="carol",       phone_primary="+70001110003", password="Carol1234",
        gender="F", date_of_birth=date(1998, 11, 5),
        city="Москва",          years_playing=3,
        ntrp_level="3.0",       stm_level="5",
        is_admin=False,
    ),
    dict(
        last_name="Дмитриев",   first_name="Дмитрий", patronymic=None,
        nickname="dmitry",      phone_primary="+70001110004", password="Dmitry1234",
        gender="M", date_of_birth=date(1990, 1, 18),
        city="Москва",          years_playing=12,
        ntrp_level="4.5",       stm_level="8",
        is_admin=False,
    ),
]


async def seed():
    async with async_session() as db:
        # --- NTRP/STM levels ---
        result = await db.execute(select(NtrpStmLevel).limit(1))
        if result.scalar_one_or_none() is None:
            for ntrp, stm, desc, sort in NTRP_STM_DATA:
                db.add(NtrpStmLevel(ntrp=ntrp, stm=stm, description=desc, sort_order=sort))
            await db.commit()
            print(f"Seeded {len(NTRP_STM_DATA)} NTRP/STM levels.")
        else:
            print("NTRP/STM levels already exist, skipping.")

        # --- Test users ---
        added = 0
        for u in TEST_USERS:
            existing = await db.execute(
                select(User).where(User.phone_primary == u["phone_primary"])
            )
            if existing.scalar_one_or_none() is not None:
                print(f"User {u['phone_primary']} already exists, skipping.")
                continue

            password = u.pop("password")
            db.add(User(
                **u,
                password_hash=hash_password(password),
                elo_rating=1500,
            ))
            added += 1

        if added:
            await db.commit()
            print(f"Seeded {added} test users.")
            print()
            print("  Телефон        Пароль       Никнейм")
            print("  +70001110001   Alice1234    alice  (admin)")
            print("  +70001110002   Boris1234    boris")
            print("  +70001110003   Carol1234    carol")
            print("  +70001110004   Dmitry1234   dmitry")


if __name__ == "__main__":
    asyncio.run(seed())
