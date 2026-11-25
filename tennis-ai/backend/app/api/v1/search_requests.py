import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.booking import CourtBooking
from app.models.search import SearchRequest, SearchResponse
from app.models.user import User, UserPreferredLocation, UserPreferredPlayer
from app.schemas.search import (
    SearchRequestCreate,
    SearchRequestListItem,
    SearchRequestResponse,
    SearchRequestUpdate,
    SearchResponseAction,
    SearchResponseOut,
)
from app.services.notification import create_notification
from app.services.premium import check_search_limit

router = APIRouter(prefix="/search-requests", tags=["search-requests"])


def _max_players_for_game_type(game_type: str) -> int:
    if game_type == "singles":
        return 1
    if game_type in ("doubles", "mixed"):
        return 3
    return 3  # 'any'


@router.post("", response_model=SearchRequestResponse, status_code=201)
async def create_search_request(
    data: SearchRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем лимит активных заявок для бесплатных пользователей
    from sqlalchemy import func
    active_count_result = await db.execute(
        select(func.count()).select_from(SearchRequest).where(
            SearchRequest.author_id == current_user.id,
            SearchRequest.is_active == True,  # noqa: E712
        )
    )
    active_count = active_count_result.scalar_one()
    check_search_limit(current_user, active_count)

    # Validate booking_id + derive start/end times from booking (ТЗ: дата и время
    # ДОЛЖНЫ совпадать с бронёй — нельзя обойти через API)
    effective_start = data.start_time
    effective_end = data.end_time
    effective_location_id = data.location_id
    effective_open_date = data.open_date

    if data.booking_id:
        from datetime import datetime as _dt, timezone as _tz
        from app.models.location import Court as _Court

        bk_result = await db.execute(
            select(CourtBooking).where(
                CourtBooking.id == data.booking_id,
                CourtBooking.user_id == current_user.id,
                CourtBooking.status == "active",
            )
        )
        bk = bk_result.scalar_one_or_none()
        if bk is None:
            raise HTTPException(status_code=400, detail="Бронь не найдена или не принадлежит вам")

        # Подгружаем корт для location_id
        court_res = await db.execute(select(_Court).where(_Court.id == bk.court_id))
        court_obj = court_res.scalar_one_or_none()

        # Override: время/дата + локация берутся из брони
        effective_start = _dt.combine(bk.date, bk.slot_start).replace(tzinfo=_tz.utc)
        effective_end = _dt.combine(bk.date, bk.slot_end).replace(tzinfo=_tz.utc)
        if court_obj:
            effective_location_id = court_obj.location_id
        effective_open_date = False  # бронь = конкретное время

    sr = SearchRequest(
        author_id=current_user.id,
        game_type=data.game_type,
        stm_level=data.stm_level,
        stm_min=data.stm_min,
        stm_max=data.stm_max,
        gender_filter=data.gender_filter,
        court_booked=data.court_booked,
        location_id=effective_location_id,
        booking_id=data.booking_id,
        start_time=effective_start,
        end_time=effective_end,
        notes=data.notes,
        only_preferred=data.only_preferred,
        open_date=effective_open_date,
        max_players=_max_players_for_game_type(data.game_type),
    )
    db.add(sr)
    await db.flush()

    # Find matching users to notify
    # (ТЗ: фильтрации по городу нет — отбор идёт по фильтрам получателя и предпочитаемым)
    query = select(User).where(
        User.id != current_user.id,
        User.is_active_search == True,  # noqa: E712
    )

    # If "only preferred" flag is set, restrict recipients to author's preferred players
    if data.only_preferred:
        pref_result = await db.execute(
            select(UserPreferredPlayer.player_id).where(
                UserPreferredPlayer.user_id == current_user.id,
                UserPreferredPlayer.is_active == True,  # noqa: E712
            )
        )
        pref_ids = [row[0] for row in pref_result.all()]
        if not pref_ids:
            # No preferred players → nobody to notify, but still create the request
            potential_recipients = []
        else:
            query = query.where(User.id.in_(pref_ids))
            result = await db.execute(query)
            potential_recipients = result.scalars().all()
    else:
        result = await db.execute(query)
        potential_recipients = result.scalars().all()

    # Recipients who have ME (sender) among THEIR preferred players.
    # Нужно для флага получателя accept_other_requests=False
    # (получатель принимает запросы только от своих предпочитаемых игроков).
    incoming_pref_result = await db.execute(
        select(UserPreferredPlayer.user_id).where(
            UserPreferredPlayer.player_id == current_user.id,
            UserPreferredPlayer.is_active == True,  # noqa: E712
        )
    )
    recipients_with_me_preferred = {row[0] for row in incoming_pref_result.all()}

    for recipient in potential_recipients:
        # Получатель принимает только запросы от своих предпочитаемых игроков
        if not recipient.accept_other_requests and recipient.id not in recipients_with_me_preferred:
            continue
        # Apply recipient's filters
        if recipient.filter_game_type and recipient.filter_game_type != "any":
            if data.game_type != "any" and data.game_type != recipient.filter_game_type:
                continue
        if recipient.filter_gender:
            if current_user.gender != recipient.filter_gender:
                continue
        if recipient.filter_stm_min is not None:
            try:
                author_stm = int(current_user.stm_level)
                if author_stm < recipient.filter_stm_min:
                    continue
            except ValueError:
                pass
        if recipient.filter_stm_max is not None:
            try:
                author_stm = int(current_user.stm_level)
                if author_stm > recipient.filter_stm_max:
                    continue
            except ValueError:
                pass
        if recipient.filter_age_min is not None or recipient.filter_age_max is not None:
            today = date.today()
            author_age = (
                today.year
                - current_user.date_of_birth.year
                - (
                    (today.month, today.day)
                    < (current_user.date_of_birth.month, current_user.date_of_birth.day)
                )
            )
            if recipient.filter_age_min and author_age < recipient.filter_age_min:
                continue
            if recipient.filter_age_max and author_age > recipient.filter_age_max:
                continue

        location_name = ""
        if data.location_id:
            from app.models.location import Location

            loc_result = await db.execute(
                select(Location).where(Location.id == data.location_id)
            )
            loc = loc_result.scalar_one_or_none()
            if loc:
                location_name = f" Локация: {loc.name}."

        court_info = ""
        if data.booking_id:
            bk2 = await db.execute(
                select(CourtBooking)
                .where(CourtBooking.id == data.booking_id)
                .options(selectinload(CourtBooking.court))
            )
            bk_obj = bk2.scalar_one_or_none()
            if bk_obj and bk_obj.court:
                slot_s = str(bk_obj.slot_start)[:5]
                slot_e = str(bk_obj.slot_end)[:5]
                court_info = f" Корт: {bk_obj.court.name} {slot_s}-{slot_e}."

        await create_notification(
            db,
            user_id=recipient.id,
            type="search_request",
            title=f"Поиск партнера: {current_user.last_name} {current_user.first_name[0]}.",
            body=(
                f"Тип: {data.game_type}. СТМ: {current_user.stm_level}."
                f"{location_name}{court_info} {effective_start.strftime('%H:%M')}-{effective_end.strftime('%H:%M')}"
            ),
            reference_type="search_request",
            reference_id=sr.id,
        )

    await db.commit()
    result = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.id == sr.id)
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses).selectinload(SearchResponse.responder),
        )
    )
    sr_out = result.scalar_one()
    _attach_booking_details(sr_out)
    return sr_out


def _attach_booking_details(sr: SearchRequest) -> SearchRequest:
    """Attach location_name, court_name, booking_date/slot_start/slot_end from loaded relationships."""
    # Location name
    if getattr(sr, 'location', None) is not None:
        sr.location_name = sr.location.name  # type: ignore[attr-defined]
    else:
        sr.location_name = None  # type: ignore[attr-defined]

    # Court / slot details from linked booking
    booking = getattr(sr, 'booking', None)
    if booking is not None:
        court = getattr(booking, 'court', None)
        sr.court_name = court.name if court else None  # type: ignore[attr-defined]
        sr.booking_date = str(booking.date)  # type: ignore[attr-defined]
        sr.booking_slot_start = str(booking.slot_start)[:5]  # type: ignore[attr-defined]
        sr.booking_slot_end = str(booking.slot_end)[:5]  # type: ignore[attr-defined]
    else:
        sr.court_name = None  # type: ignore[attr-defined]
        sr.booking_date = None  # type: ignore[attr-defined]
        sr.booking_slot_start = None  # type: ignore[attr-defined]
        sr.booking_slot_end = None  # type: ignore[attr-defined]
    return sr


def _attach_counts(sr: SearchRequest, current_user_id: uuid.UUID) -> SearchRequest:
    """Attach computed fields (pending_count, responses_count, has_my_response, my_response_status, is_expired) to a SearchRequest."""
    from datetime import timezone
    now = datetime.now(timezone.utc)
    responses = sr.responses or []
    pending = sum(1 for r in responses if r.status == "pending")
    my_resp = next((r for r in responses if r.responder_id == current_user_id), None)
    sr.pending_count = pending  # type: ignore[attr-defined]
    sr.responses_count = len(responses)  # type: ignore[attr-defined]
    sr.has_my_response = my_resp is not None  # type: ignore[attr-defined]
    sr.my_response_status = my_resp.status if my_resp else None  # type: ignore[attr-defined]
    # ТЗ: получатели видят просроченные запросы со статусом «Просрочено»
    if sr.open_date:
        sr.is_expired = False  # type: ignore[attr-defined]
    else:
        end_aware = sr.end_time.replace(tzinfo=timezone.utc) if sr.end_time.tzinfo is None else sr.end_time
        sr.is_expired = end_aware < now  # type: ignore[attr-defined]
    return sr


@router.get("/mine", response_model=list[SearchRequestListItem])
async def list_my_search_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import timezone
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.author_id == current_user.id)
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses),
        )
        .order_by(SearchRequest.created_at.desc())
    )
    items = list(result.scalars().all())

    # Auto-expire: deactivate searches whose end_time has passed
    changed = False
    for sr in items:
        if sr.is_active and not sr.open_date:
            end_aware = sr.end_time.replace(tzinfo=timezone.utc) if sr.end_time.tzinfo is None else sr.end_time
            if end_aware < now:
                sr.is_active = False
                changed = True
    if changed:
        await db.commit()

    for sr in items:
        _attach_counts(sr, current_user.id)
        _attach_booking_details(sr)
    return items


@router.get("/available", response_model=list[SearchRequestListItem])
async def list_available_search_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active search requests from other users (preferred players first, then others)."""
    _now = datetime.now()
    result = await db.execute(
        select(SearchRequest)
        .where(
            SearchRequest.author_id != current_user.id,
            SearchRequest.is_active == True,  # noqa: E712
            # Просроченные (время игры прошло) не показываем; open_date не имеет срока
            (SearchRequest.open_date == True) | (SearchRequest.end_time > _now),  # noqa: E712
        )
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses),
        )
        .order_by(SearchRequest.created_at.desc())
    )
    all_requests = list(result.scalars().all())

    # Фильтр по полу и диапазону СТМ, заданным автором поиска
    def _stm_float(v: str | None) -> float | None:
        try:
            return float(v) if v else None
        except ValueError:
            return None

    my_stm = _stm_float(current_user.stm_level)

    def _matches_filters(sr: SearchRequest) -> bool:
        if sr.gender_filter and sr.gender_filter != current_user.gender:
            return False
        stm_min = _stm_float(sr.stm_min)
        stm_max = _stm_float(sr.stm_max)
        if (stm_min is not None or stm_max is not None) and my_stm is not None:
            if stm_min is not None and my_stm < stm_min:
                return False
            if stm_max is not None and my_stm > stm_max:
                return False
        return True

    all_requests = [sr for sr in all_requests if _matches_filters(sr)]

    # Get preferred player IDs for sorting
    pp_result = await db.execute(
        select(UserPreferredPlayer.player_id).where(
            UserPreferredPlayer.user_id == current_user.id,
            UserPreferredPlayer.is_active == True,  # noqa: E712
        )
    )
    preferred_ids = {row[0] for row in pp_result.all()}

    for sr in all_requests:
        _attach_counts(sr, current_user.id)
        _attach_booking_details(sr)

    # Sort: preferred players first
    from_preferred = [r for r in all_requests if r.author_id in preferred_ids]
    from_others = [r for r in all_requests if r.author_id not in preferred_ids]
    return from_preferred + from_others


@router.get("/{sr_id}", response_model=SearchRequestResponse)
async def get_search_request(
    sr_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.id == sr_id)
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses).selectinload(SearchResponse.responder),
        )
    )
    sr = result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")
    _attach_booking_details(sr)
    return sr


@router.put("/{sr_id}", response_model=SearchRequestResponse)
async def update_search_request(
    sr_id: uuid.UUID,
    data: SearchRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.id == sr_id, SearchRequest.author_id == current_user.id)
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses).selectinload(SearchResponse.responder),
        )
    )
    sr = result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(sr, key, value)
    if data.game_type:
        sr.max_players = _max_players_for_game_type(data.game_type)
    await db.commit()
    # Re-fetch with relationships
    result2 = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.id == sr_id)
        .options(
            selectinload(SearchRequest.author),
            selectinload(SearchRequest.location),
            selectinload(SearchRequest.booking).selectinload(CourtBooking.court),
            selectinload(SearchRequest.responses).selectinload(SearchResponse.responder),
        )
    )
    sr = result2.scalar_one()
    _attach_booking_details(sr)
    return sr


@router.delete("/{sr_id}", status_code=204)
async def deactivate_search_request(
    sr_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchRequest)
        .where(SearchRequest.id == sr_id, SearchRequest.author_id == current_user.id)
        .options(selectinload(SearchRequest.responses))
    )
    sr = result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")
    sr.is_active = False

    # ТЗ: уведомить уже откликнувшихся игроков, что поиск завершён
    for resp in sr.responses:
        if resp.status in ("pending", "confirmed"):
            await create_notification(
                db,
                user_id=resp.responder_id,
                type="search_completed",
                title=(
                    f"{current_user.last_name} {current_user.first_name[0]}. "
                    f"завершил(а) поиск спарринг-партнёра"
                ),
                reference_type="search_request",
                reference_id=sr.id,
            )

    await db.commit()


# --- Responses ---


@router.post("/{sr_id}/respond", response_model=SearchResponseOut, status_code=201)
async def respond_to_search(
    sr_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchRequest).where(SearchRequest.id == sr_id)
    )
    sr = result.scalar_one_or_none()
    if sr is None or not sr.is_active:
        raise HTTPException(status_code=404, detail="Search request not found or inactive")
    if sr.author_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot respond to your own request")

    response = SearchResponse(
        search_request_id=sr_id, responder_id=current_user.id
    )
    db.add(response)
    try:
        await db.flush()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Already responded")

    await create_notification(
        db,
        user_id=sr.author_id,
        type="search_response",
        title=f"{current_user.last_name} {current_user.first_name[0]}. — Предложение принято",
        reference_type="search_request",
        reference_id=sr.id,
    )

    await db.commit()
    result = await db.execute(
        select(SearchResponse)
        .where(SearchResponse.id == response.id)
        .options(selectinload(SearchResponse.responder))
    )
    return result.scalar_one()


@router.put("/{sr_id}/responses/{resp_id}/confirm", response_model=SearchResponseOut)
async def confirm_response(
    sr_id: uuid.UUID,
    resp_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(
        select(SearchRequest).where(
            SearchRequest.id == sr_id, SearchRequest.author_id == current_user.id
        )
    )
    sr = sr_result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")

    if sr.confirmed_count >= sr.max_players:
        raise HTTPException(status_code=400, detail="Maximum players already confirmed")

    result = await db.execute(
        select(SearchResponse)
        .where(SearchResponse.id == resp_id, SearchResponse.search_request_id == sr_id)
        .options(selectinload(SearchResponse.responder))
    )
    resp = result.scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=404, detail="Response not found")

    resp.status = "confirmed"
    sr.confirmed_count += 1

    # Все места заняты — поиск больше не активен (уходит из «Доступных»)
    if sr.confirmed_count >= sr.max_players:
        sr.is_active = False

    await create_notification(
        db,
        user_id=resp.responder_id,
        type="search_confirmed",
        title=f"{current_user.last_name} {current_user.first_name[0]}. подтвердил(а) игру",
        reference_type="search_request",
        reference_id=sr_id,
    )

    await db.commit()
    await db.refresh(resp)
    return resp


@router.put("/{sr_id}/responses/{resp_id}/decline", response_model=SearchResponseOut)
async def decline_response(
    sr_id: uuid.UUID,
    resp_id: uuid.UUID,
    data: SearchResponseAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(
        select(SearchRequest).where(
            SearchRequest.id == sr_id, SearchRequest.author_id == current_user.id
        )
    )
    sr = sr_result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")

    result = await db.execute(
        select(SearchResponse)
        .where(SearchResponse.id == resp_id, SearchResponse.search_request_id == sr_id)
        .options(selectinload(SearchResponse.responder))
    )
    resp = result.scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=404, detail="Response not found")

    resp.status = "declined"
    resp.decline_reason = data.decline_reason

    reason_text = f" Причина: {data.decline_reason}" if data.decline_reason else ""
    await create_notification(
        db,
        user_id=resp.responder_id,
        type="search_declined",
        title=f"Отказ от {current_user.last_name} {current_user.first_name[0]}.{reason_text}",
        reference_type="search_request",
        reference_id=sr_id,
    )

    await db.commit()
    await db.refresh(resp)
    return resp


@router.put("/{sr_id}/responses/{resp_id}/reset", response_model=SearchResponseOut)
async def reset_response(
    sr_id: uuid.UUID,
    resp_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sr_result = await db.execute(
        select(SearchRequest).where(
            SearchRequest.id == sr_id, SearchRequest.author_id == current_user.id
        )
    )
    sr = sr_result.scalar_one_or_none()
    if sr is None:
        raise HTTPException(status_code=404, detail="Search request not found")

    result = await db.execute(
        select(SearchResponse)
        .where(SearchResponse.id == resp_id, SearchResponse.search_request_id == sr_id)
        .options(selectinload(SearchResponse.responder))
    )
    resp = result.scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=404, detail="Response not found")

    prev_status = resp.status
    if resp.status == "confirmed":
        sr.confirmed_count = max(0, sr.confirmed_count - 1)
        # Освободилось место — поиск снова активен
        if sr.confirmed_count < sr.max_players:
            sr.is_active = True
    resp.status = "reset"

    await create_notification(
        db,
        user_id=resp.responder_id,
        type="search_reset",
        title=f"Корректировка: предыдущий статус «{prev_status}»",
        reference_type="search_request",
        reference_id=sr_id,
    )

    await db.commit()
    await db.refresh(resp)
    return resp
