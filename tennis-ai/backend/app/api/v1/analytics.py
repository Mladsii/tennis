"""Аналитика клуба: heatmap кортов, выручка, тренеры, экспорт Excel."""
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user
from app.database import get_db
from app.models.booking import CourtBooking
from app.models.cash import CashTransaction
from app.models.location import Court
from app.models.training import Training
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _default_range() -> tuple[date, date]:
    today = date.today()
    return today - timedelta(days=29), today


# ─────────────────────────────────────────────────────────────
# Heatmap: загрузка кортов (час × день недели)
# ─────────────────────────────────────────────────────────────

class HeatmapCell(BaseModel):
    dow: int          # 0=вс … 6=сб (PostgreSQL DOW)
    hour: int         # 8 … 21
    count: int


class HeatmapResponse(BaseModel):
    location_id: str
    date_from: date
    date_to: date
    cells: list[HeatmapCell]
    max_count: int


@router.get("/court-heatmap", response_model=HeatmapResponse)
async def court_heatmap(
    location_id: str = Query(...),
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if date_from is None:
        date_from, date_to = _default_range()
    if date_to is None:
        date_to = date.today()

    # Получаем court_id-шники локации
    court_q = await db.execute(
        select(Court.id).where(Court.location_id == location_id)
    )
    court_ids = [r[0] for r in court_q.all()]

    if not court_ids:
        return HeatmapResponse(location_id=location_id, date_from=date_from,
                               date_to=date_to, cells=[], max_count=0)

    stmt = (
        select(
            extract("dow", CourtBooking.date).label("dow"),
            extract("hour", CourtBooking.slot_start).label("hour"),
            func.count().label("cnt"),
        )
        .where(
            CourtBooking.court_id.in_(court_ids),
            CourtBooking.date >= date_from,
            CourtBooking.date <= date_to,
            CourtBooking.status == "active",
        )
        .group_by("dow", "hour")
        .order_by("dow", "hour")
    )
    result = await db.execute(stmt)
    cells = [HeatmapCell(dow=int(r.dow), hour=int(r.hour), count=r.cnt)
             for r in result.all()]
    max_count = max((c.count for c in cells), default=0)

    return HeatmapResponse(
        location_id=location_id, date_from=date_from, date_to=date_to,
        cells=cells, max_count=max_count,
    )


# ─────────────────────────────────────────────────────────────
# Выручка: по дням + разбивка по типу оплаты
# ─────────────────────────────────────────────────────────────

class RevenueDayItem(BaseModel):
    day: date
    cash: float
    card: float
    sbp: float
    subscription: float
    total: float


class RevenueResponse(BaseModel):
    date_from: date
    date_to: date
    items: list[RevenueDayItem]
    totals: RevenueDayItem


@router.get("/revenue", response_model=RevenueResponse)
async def revenue_report(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if date_from is None:
        date_from, date_to = _default_range()
    if date_to is None:
        date_to = date.today()

    stmt = (
        select(
            func.date(CashTransaction.created_at).label("day"),
            CashTransaction.payment_type,
            func.sum(CashTransaction.amount).label("total"),
        )
        .where(
            CashTransaction.status == "completed",
            func.date(CashTransaction.created_at) >= date_from,
            func.date(CashTransaction.created_at) <= date_to,
        )
        .group_by("day", CashTransaction.payment_type)
        .order_by("day")
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Собираем по дням
    days_map: dict[date, dict[str, float]] = {}
    for r in rows:
        d = r.day
        if d not in days_map:
            days_map[d] = {"cash": 0, "card": 0, "sbp": 0, "subscription": 0}
        if r.payment_type in days_map[d]:
            days_map[d][r.payment_type] += float(r.total)

    items: list[RevenueDayItem] = []
    grand = {"cash": 0.0, "card": 0.0, "sbp": 0.0, "subscription": 0.0}

    for d in sorted(days_map):
        v = days_map[d]
        tot = v["cash"] + v["card"] + v["sbp"] + v["subscription"]
        items.append(RevenueDayItem(day=d, **v, total=tot))
        for k in grand:
            grand[k] += v[k]

    gt = sum(grand.values())
    totals = RevenueDayItem(day=date_to, **grand, total=gt)

    return RevenueResponse(date_from=date_from, date_to=date_to, items=items, totals=totals)


# ─────────────────────────────────────────────────────────────
# Тренеры: часы + количество тренировок
# ─────────────────────────────────────────────────────────────

class TrainerItem(BaseModel):
    trainer_id: str
    first_name: str
    last_name: str
    nickname: str
    sessions: int
    hours: float


class TrainersResponse(BaseModel):
    date_from: date
    date_to: date
    items: list[TrainerItem]


@router.get("/trainers", response_model=TrainersResponse)
async def trainers_report(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if date_from is None:
        date_from, date_to = _default_range()
    if date_to is None:
        date_to = date.today()

    stmt = (
        select(
            User.id,
            User.first_name,
            User.last_name,
            User.nickname,
            func.count(Training.id).label("sessions"),
            func.sum(
                extract("epoch", Training.end_time - Training.start_time) / 3600
            ).label("hours"),
        )
        .join(Training, Training.trainer_id == User.id)
        .where(
            Training.status != "cancelled",
            func.date(Training.start_time) >= date_from,
            func.date(Training.start_time) <= date_to,
        )
        .group_by(User.id, User.first_name, User.last_name, User.nickname)
        .order_by(func.sum(
            extract("epoch", Training.end_time - Training.start_time) / 3600
        ).desc())
    )
    result = await db.execute(stmt)
    items = [
        TrainerItem(
            trainer_id=str(r.id),
            first_name=r.first_name,
            last_name=r.last_name,
            nickname=r.nickname,
            sessions=r.sessions,
            hours=round(float(r.hours or 0), 1),
        )
        for r in result.all()
    ]
    return TrainersResponse(date_from=date_from, date_to=date_to, items=items)


# ─────────────────────────────────────────────────────────────
# Экспорт Excel: брони
# ─────────────────────────────────────────────────────────────

@router.get("/export/bookings")
async def export_bookings(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    location_id: str = Query(default=None),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        import openpyxl
    except ImportError:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    if date_from is None:
        date_from, date_to = _default_range()
    if date_to is None:
        date_to = date.today()

    stmt = (
        select(CourtBooking, Court, User)
        .join(Court, Court.id == CourtBooking.court_id)
        .join(User, User.id == CourtBooking.user_id)
        .where(
            CourtBooking.date >= date_from,
            CourtBooking.date <= date_to,
        )
        .order_by(CourtBooking.date, CourtBooking.slot_start)
    )
    if location_id:
        stmt = stmt.where(Court.location_id == location_id)

    result = await db.execute(stmt)
    rows = result.all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Брони"

    from openpyxl.styles import Font, PatternFill, Alignment
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1a6f3c")

    headers = ["Дата", "Корт", "Начало", "Конец", "Игрок", "Никнейм", "Статус"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row_idx, (booking, court, user) in enumerate(rows, 2):
        ws.cell(row=row_idx, column=1, value=str(booking.date))
        ws.cell(row=row_idx, column=2, value=court.name)
        ws.cell(row=row_idx, column=3, value=str(booking.slot_start)[:5])
        ws.cell(row=row_idx, column=4, value=str(booking.slot_end)[:5])
        ws.cell(row=row_idx, column=5, value=f"{user.last_name} {user.first_name}")
        ws.cell(row=row_idx, column=6, value=f"@{user.nickname}")
        ws.cell(row=row_idx, column=7, value=booking.status)

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max_len + 3

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    fname = f"bookings_{date_from}_{date_to}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─────────────────────────────────────────────────────────────
# Экспорт Excel: выручка
# ─────────────────────────────────────────────────────────────

@router.get("/export/revenue")
async def export_revenue(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    if date_from is None:
        date_from, date_to = _default_range()
    if date_to is None:
        date_to = date.today()

    # Reuse revenue logic
    stmt = (
        select(
            func.date(CashTransaction.created_at).label("day"),
            CashTransaction.payment_type,
            func.sum(CashTransaction.amount).label("total"),
        )
        .where(
            CashTransaction.status == "completed",
            func.date(CashTransaction.created_at) >= date_from,
            func.date(CashTransaction.created_at) <= date_to,
        )
        .group_by("day", CashTransaction.payment_type)
        .order_by("day")
    )
    result = await db.execute(stmt)
    rows = result.all()

    days_map: dict = {}
    for r in rows:
        d = str(r.day)
        if d not in days_map:
            days_map[d] = {"cash": 0.0, "card": 0.0, "sbp": 0.0, "subscription": 0.0}
        if r.payment_type in days_map[d]:
            days_map[d][r.payment_type] += float(r.total)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Выручка"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1a6f3c")
    headers = ["Дата", "Наличные", "Карта", "СБП", "Абонемент", "Итого"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    grand = [0.0, 0.0, 0.0, 0.0]
    for row_idx, d in enumerate(sorted(days_map), 2):
        v = days_map[d]
        vals = [v["cash"], v["card"], v["sbp"], v["subscription"]]
        ws.cell(row=row_idx, column=1, value=d)
        for ci, val in enumerate(vals, 2):
            ws.cell(row=row_idx, column=ci, value=round(val, 2))
            grand[ci - 2] += val
        ws.cell(row=row_idx, column=6, value=round(sum(vals), 2))

    # Totals row
    total_row = len(days_map) + 2
    ws.cell(row=total_row, column=1, value="ИТОГО").font = Font(bold=True)
    for ci, val in enumerate(grand, 2):
        cell = ws.cell(row=total_row, column=ci, value=round(val, 2))
        cell.font = Font(bold=True)
    ws.cell(row=total_row, column=6, value=round(sum(grand), 2)).font = Font(bold=True)

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 14

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"revenue_{date_from}_{date_to}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
