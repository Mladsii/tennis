"""
Tennis Club Admin Bot (aiogram 3)
==================================
Команды:
  /today      — брони на сегодня
  /revenue    — выручка за сегодня
  /queue      — активная очередь
  /players    — кол-во игроков
  /export     — Excel отчёт за сегодня
  /week       — выручка за 7 дней
"""
import asyncio
import io
import os
from datetime import date, timedelta
from decimal import Decimal

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import (
    BufferedInputFile, Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
)
from dotenv import load_dotenv
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

BOT_TOKEN    = os.environ["BOT_TOKEN"]
ADMIN_IDS    = [int(x) for x in os.getenv("ADMIN_CHAT_ID", "").split(",") if x.strip()]
DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

bot = Bot(token=BOT_TOKEN)
dp  = Dispatcher()


# ─── helpers ─────────────────────────────────────────────────

def is_admin(message: Message) -> bool:
    return not ADMIN_IDS or message.from_user.id in ADMIN_IDS

async def get_db() -> AsyncSession:
    return AsyncSessionLocal()

def fmt_money(v) -> str:
    return f"{float(v or 0):,.0f} ₽".replace(",", " ")


# ─── /start ──────────────────────────────────────────────────

@dp.message(Command("start"))
async def cmd_start(msg: Message):
    if not is_admin(msg):
        await msg.answer("⛔ Нет доступа.")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📅 Брони сегодня", callback_data="today"),
         InlineKeyboardButton(text="💰 Выручка",       callback_data="revenue")],
        [InlineKeyboardButton(text="⏳ Очередь",        callback_data="queue"),
         InlineKeyboardButton(text="📊 Неделя",         callback_data="week")],
        [InlineKeyboardButton(text="👤 Игроки",         callback_data="players"),
         InlineKeyboardButton(text="⬇ Excel сегодня",  callback_data="export")],
    ])
    await msg.answer("🎾 <b>Tennis Club Admin</b>\n\nВыберите отчёт:", parse_mode="HTML", reply_markup=kb)


# ─── /today ──────────────────────────────────────────────────

async def _today_text() -> str:
    today = date.today()
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT c.name, b.slot_start, b.slot_end, u.last_name, u.first_name
            FROM court_bookings b
            JOIN courts c ON c.id = b.court_id
            JOIN users  u ON u.id = b.user_id
            WHERE b.date = :d AND b.status = 'active'
            ORDER BY b.slot_start, c.name
        """), {"d": today})
        rows = res.fetchall()

    if not rows:
        return f"📅 Брони на <b>{today}</b>: нет"

    lines = [f"📅 <b>Брони на {today}</b> ({len(rows)} шт.):\n"]
    for court, start, end, ln, fn in rows:
        lines.append(f"  {str(start)[:5]}–{str(end)[:5]}  {court}  —  {ln} {fn}")
    return "\n".join(lines)

@dp.message(Command("today"))
async def cmd_today(msg: Message):
    if not is_admin(msg): return
    await msg.answer(await _today_text(), parse_mode="HTML")

@dp.callback_query(F.data == "today")
async def cb_today(cb: CallbackQuery):
    await cb.message.answer(await _today_text(), parse_mode="HTML")
    await cb.answer()


# ─── /revenue ────────────────────────────────────────────────

async def _revenue_text(days: int = 1) -> str:
    date_from = date.today() - timedelta(days=days - 1)
    date_to   = date.today()
    label     = "сегодня" if days == 1 else f"за {days} дней"

    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT payment_type, SUM(amount) as total
            FROM cash_transactions
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN :f AND :t
            GROUP BY payment_type
        """), {"f": date_from, "t": date_to})
        rows = res.fetchall()

    if not rows:
        return f"💰 Выручка {label}: <b>нет данных</b>"

    labels = {"cash": "💵 Наличные", "card": "💳 Карта", "sbp": "📱 СБП", "subscription": "🎫 Абонемент"}
    total  = sum(float(r.total) for r in rows)
    lines  = [f"💰 <b>Выручка {label}</b>\n"]
    for r in sorted(rows, key=lambda x: -float(x.total)):
        lbl = labels.get(r.payment_type, r.payment_type)
        lines.append(f"  {lbl}: <b>{fmt_money(r.total)}</b>")
    lines.append(f"\n  <b>ИТОГО: {fmt_money(total)}</b>")
    return "\n".join(lines)

@dp.message(Command("revenue"))
async def cmd_revenue(msg: Message):
    if not is_admin(msg): return
    await msg.answer(await _revenue_text(1), parse_mode="HTML")

@dp.callback_query(F.data == "revenue")
async def cb_revenue(cb: CallbackQuery):
    await cb.message.answer(await _revenue_text(1), parse_mode="HTML")
    await cb.answer()

@dp.message(Command("week"))
async def cmd_week(msg: Message):
    if not is_admin(msg): return
    await msg.answer(await _revenue_text(7), parse_mode="HTML")

@dp.callback_query(F.data == "week")
async def cb_week(cb: CallbackQuery):
    await cb.message.answer(await _revenue_text(7), parse_mode="HTML")
    await cb.answer()


# ─── /queue ──────────────────────────────────────────────────

async def _queue_text() -> str:
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT u.last_name, u.first_name, c.name, q.date, q.slot_start, q.status
            FROM waiting_queue q
            JOIN users  u ON u.id = q.user_id
            JOIN courts c ON c.id = q.court_id
            WHERE q.status IN ('waiting', 'notified')
            ORDER BY q.date, q.slot_start
        """))
        rows = res.fetchall()

    if not rows:
        return "⏳ Очередь пуста"

    lines = [f"⏳ <b>Активная очередь</b> ({len(rows)} чел.):\n"]
    for ln, fn, court, d, slot, status in rows:
        emoji = "🔔" if status == "notified" else "🕐"
        lines.append(f"  {emoji} {ln} {fn} — {court} {d} {str(slot)[:5]}")
    return "\n".join(lines)

@dp.message(Command("queue"))
async def cmd_queue(msg: Message):
    if not is_admin(msg): return
    await msg.answer(await _queue_text(), parse_mode="HTML")

@dp.callback_query(F.data == "queue")
async def cb_queue(cb: CallbackQuery):
    await cb.message.answer(await _queue_text(), parse_mode="HTML")
    await cb.answer()


# ─── /players ────────────────────────────────────────────────

async def _players_text() -> str:
    async with AsyncSessionLocal() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM users"))).scalar()
        new7  = (await db.execute(text(
            "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
        ))).scalar()
    return f"👤 <b>Игроки</b>\n  Всего: <b>{total}</b>\n  Новых за 7 дней: <b>{new7}</b>"

@dp.message(Command("players"))
async def cmd_players(msg: Message):
    if not is_admin(msg): return
    await msg.answer(await _players_text(), parse_mode="HTML")

@dp.callback_query(F.data == "players")
async def cb_players(cb: CallbackQuery):
    await cb.message.answer(await _players_text(), parse_mode="HTML")
    await cb.answer()


# ─── /export ─────────────────────────────────────────────────

async def _export_excel() -> BufferedInputFile:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    today = date.today()
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT c.name as court, b.slot_start, b.slot_end,
                   u.last_name, u.first_name, u.nickname, b.status
            FROM court_bookings b
            JOIN courts c ON c.id = b.court_id
            JOIN users  u ON u.id = b.user_id
            WHERE b.date = :d
            ORDER BY b.slot_start, c.name
        """), {"d": today})
        bookings = res.fetchall()

        res2 = await db.execute(text("""
            SELECT payment_type, SUM(amount) as total
            FROM cash_transactions
            WHERE status = 'completed' AND DATE(created_at) = :d
            GROUP BY payment_type
        """), {"d": today})
        revenue = res2.fetchall()

    wb = openpyxl.Workbook()

    # Лист 1: Брони
    ws1 = wb.active
    ws1.title = f"Брони {today}"
    hf = Font(bold=True, color="FFFFFF")
    hfill = PatternFill("solid", fgColor="1a6f3c")
    for ci, h in enumerate(["Корт", "Начало", "Конец", "Игрок", "Ник", "Статус"], 1):
        c = ws1.cell(row=1, column=ci, value=h)
        c.font = hf; c.fill = hfill; c.alignment = Alignment(horizontal="center")

    for ri, row in enumerate(bookings, 2):
        ws1.cell(ri, 1, row.court)
        ws1.cell(ri, 2, str(row.slot_start)[:5])
        ws1.cell(ri, 3, str(row.slot_end)[:5])
        ws1.cell(ri, 4, f"{row.last_name} {row.first_name}")
        ws1.cell(ri, 5, f"@{row.nickname}")
        ws1.cell(ri, 6, row.status)

    for col in ws1.columns:
        ws1.column_dimensions[col[0].column_letter].width = 16

    # Лист 2: Выручка
    ws2 = wb.create_sheet(f"Выручка {today}")
    labels = {"cash": "Наличные", "card": "Карта", "sbp": "СБП", "subscription": "Абонемент"}
    for ci, h in enumerate(["Тип оплаты", "Сумма, ₽"], 1):
        c = ws2.cell(row=1, column=ci, value=h)
        c.font = hf; c.fill = hfill
    total = 0.0
    for ri, r in enumerate(revenue, 2):
        ws2.cell(ri, 1, labels.get(r.payment_type, r.payment_type))
        ws2.cell(ri, 2, round(float(r.total), 2))
        total += float(r.total)
    tr = len(revenue) + 2
    ws2.cell(tr, 1, "ИТОГО").font = Font(bold=True)
    ws2.cell(tr, 2, round(total, 2)).font = Font(bold=True)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return BufferedInputFile(buf.read(), filename=f"report_{today}.xlsx")

@dp.message(Command("export"))
async def cmd_export(msg: Message):
    if not is_admin(msg): return
    await msg.answer("⏳ Формирую Excel...")
    try:
        f = await _export_excel()
        await msg.answer_document(f, caption=f"📊 Отчёт за {date.today()}")
    except Exception as e:
        await msg.answer(f"❌ Ошибка: {e}")

@dp.callback_query(F.data == "export")
async def cb_export(cb: CallbackQuery):
    await cb.message.answer("⏳ Формирую Excel...")
    try:
        f = await _export_excel()
        await cb.message.answer_document(f, caption=f"📊 Отчёт за {date.today()}")
    except Exception as e:
        await cb.message.answer(f"❌ Ошибка: {e}")
    await cb.answer()


# ─── /help ───────────────────────────────────────────────────

@dp.message(Command("help"))
async def cmd_help(msg: Message):
    await msg.answer(
        "🎾 <b>Tennis Club Bot</b>\n\n"
        "/today   — брони на сегодня\n"
        "/revenue — выручка за сегодня\n"
        "/week    — выручка за 7 дней\n"
        "/queue   — активная очередь\n"
        "/players — статистика игроков\n"
        "/export  — Excel отчёт (брони + выручка)\n"
        "/start   — главное меню",
        parse_mode="HTML"
    )


# ─── entry point ─────────────────────────────────────────────

async def main():
    print("🤖 Bot starting...")
    await dp.start_polling(bot, skip_updates=True)

if __name__ == "__main__":
    asyncio.run(main())
