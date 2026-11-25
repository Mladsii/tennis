"""Касса: смены и платёжные транзакции."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.cash import CashSession, CashTransaction
from app.models.subscription import UserSubscription
from app.models.user import User
from app.schemas.cash import (
    CashReportResponse,
    CashSessionCreate,
    CashSessionResponse,
    CashTransactionCreate,
    CashTransactionResponse,
)

router = APIRouter(prefix="/cash", tags=["cash"])

SESSION_OPTS = [
    selectinload(CashSession.opened_by),
    selectinload(CashSession.transactions).selectinload(CashTransaction.user),
    selectinload(CashSession.transactions).selectinload(CashTransaction.created_by),
]


def _session_resp(s: CashSession) -> CashSessionResponse:
    return CashSessionResponse(
        id=s.id,
        opened_by=s.opened_by,
        opened_at=s.created_at,
        closed_at=s.closed_at,
        status=s.status,
        notes=s.notes,
        created_at=s.created_at,
    )


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions/current", response_model=CashSessionResponse | None)
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashSession)
        .where(CashSession.status == "open")
        .options(*SESSION_OPTS)
        .order_by(CashSession.created_at.desc())
        .limit(1)
    )
    s = res.scalar_one_or_none()
    return _session_resp(s) if s else None


@router.get("/sessions", response_model=list[CashSessionResponse])
async def list_sessions(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashSession)
        .options(selectinload(CashSession.opened_by))
        .order_by(CashSession.created_at.desc())
        .limit(limit)
    )
    return [_session_resp(s) for s in res.scalars().all()]


@router.post("/sessions/open", response_model=CashSessionResponse, status_code=201)
async def open_session(
    data: CashSessionCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    # Проверяем — нет ли уже открытой смены
    existing = await db.execute(
        select(CashSession).where(CashSession.status == "open").limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Смена уже открыта")
    s = CashSession(opened_by_id=admin.id, status="open", notes=data.notes)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    res = await db.execute(
        select(CashSession).where(CashSession.id == s.id).options(*SESSION_OPTS)
    )
    return _session_resp(res.scalar_one())


@router.post("/sessions/{session_id}/close", response_model=CashSessionResponse)
async def close_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashSession).where(CashSession.id == session_id).options(*SESSION_OPTS)
    )
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Смена не найдена")
    if s.status == "closed":
        raise HTTPException(status_code=400, detail="Смена уже закрыта")
    s.status = "closed"
    s.closed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(s)
    res2 = await db.execute(
        select(CashSession).where(CashSession.id == s.id).options(*SESSION_OPTS)
    )
    return _session_resp(res2.scalar_one())


# ── Transactions ───────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/transactions", response_model=list[CashTransactionResponse])
async def list_transactions(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashTransaction)
        .where(CashTransaction.session_id == session_id)
        .options(
            selectinload(CashTransaction.user),
            selectinload(CashTransaction.created_by),
        )
        .order_by(CashTransaction.created_at.desc())
    )
    return list(res.scalars().all())


@router.post("/transactions", response_model=CashTransactionResponse, status_code=201)
async def create_transaction(
    data: CashTransactionCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    # Найти открытую смену
    sess_res = await db.execute(
        select(CashSession).where(CashSession.status == "open").limit(1)
    )
    session = sess_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="Нет открытой смены")

    # Если оплата абонементом — списать часы
    if data.payment_type == "subscription" and data.subscription_id:
        sub_res = await db.execute(
            select(UserSubscription).where(
                UserSubscription.id == data.subscription_id,
                UserSubscription.status == "active",
            )
        )
        sub = sub_res.scalar_one_or_none()
        if not sub:
            raise HTTPException(status_code=404, detail="Активный абонемент не найден")
        # Вычитаем 0.5 часа за один 30-минутный слот (или amount/200 * 0.5)
        hours_to_deduct = float(data.amount) / 200 if float(data.amount) > 0 else 0.5
        if float(sub.hours_remaining) < hours_to_deduct:
            raise HTTPException(status_code=400, detail="Недостаточно часов в абонементе")
        sub.hours_remaining = float(sub.hours_remaining) - hours_to_deduct
        if float(sub.hours_remaining) <= 0:
            sub.status = "exhausted"

    tx = CashTransaction(
        session_id=session.id,
        booking_id=data.booking_id,
        user_id=data.user_id,
        created_by_id=admin.id,
        amount=data.amount,
        payment_type=data.payment_type,
        description=data.description,
        status="completed",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    res = await db.execute(
        select(CashTransaction)
        .where(CashTransaction.id == tx.id)
        .options(selectinload(CashTransaction.user), selectinload(CashTransaction.created_by))
    )
    return res.scalar_one()


@router.post("/transactions/{tx_id}/refund", response_model=CashTransactionResponse)
async def refund_transaction(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashTransaction)
        .where(CashTransaction.id == tx_id)
        .options(selectinload(CashTransaction.user), selectinload(CashTransaction.created_by))
    )
    tx = res.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    if tx.status == "refunded":
        raise HTTPException(status_code=400, detail="Уже возвращено")
    tx.status = "refunded"
    await db.commit()
    await db.refresh(tx)
    return tx


# ── Z-Report ──────────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/report", response_model=CashReportResponse)
async def get_report(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(CashSession).where(CashSession.id == session_id).options(*SESSION_OPTS)
    )
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Смена не найдена")

    txs = [t for t in s.transactions if t.status == "completed"]

    def _sum(ptype: str) -> Decimal:
        return Decimal(str(sum(float(t.amount) for t in txs if t.payment_type == ptype)))

    total_cash = _sum("cash")
    total_card = _sum("card")
    total_sbp = _sum("sbp")
    total_sub = _sum("subscription")

    return CashReportResponse(
        session=_session_resp(s),
        total_cash=total_cash,
        total_card=total_card,
        total_sbp=total_sbp,
        total_subscription=total_sub,
        total_all=total_cash + total_card + total_sbp + total_sub,
        transaction_count=len(txs),
        transactions=s.transactions,
    )
