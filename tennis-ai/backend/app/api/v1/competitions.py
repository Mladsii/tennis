import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.competition import Competition, CompetitionGroup, CompetitionParticipant
from app.models.user import User
from app.services.premium import check_organize_competition
from app.schemas.competition import (
    CompetitionCreate,
    CompetitionGroupCreate,
    CompetitionGroupResponse,
    CompetitionListItem,
    CompetitionResponse,
    RegisterPayload,
)

router = APIRouter(prefix="/competitions", tags=["competitions"])


def _load_competition_full(comp_id: uuid.UUID):
    return (
        select(Competition)
        .where(Competition.id == comp_id)
        .options(
            selectinload(Competition.organizer),
            selectinload(Competition.groups)
            .selectinload(CompetitionGroup.participants)
            .selectinload(CompetitionParticipant.user),
        )
    )


@router.get("", response_model=list[CompetitionListItem])
async def list_competitions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All non-finished competitions, newest first."""
    result = await db.execute(
        select(Competition)
        .where(Competition.status != "finished")
        .options(selectinload(Competition.organizer))
        .order_by(Competition.start_date.desc())
    )
    comps = list(result.scalars().all())

    # Aggregate participant counts in one query
    counts_res = await db.execute(
        select(
            CompetitionParticipant.competition_id,
            func.count().label("cnt"),
        )
        .where(CompetitionParticipant.status == "registered")
        .group_by(CompetitionParticipant.competition_id)
    )
    counts = {row.competition_id: row.cnt for row in counts_res.all()}

    out = []
    for c in comps:
        out.append(
            CompetitionListItem(
                id=c.id,
                name=c.name,
                organizer=c.organizer,
                start_date=c.start_date,
                end_date=c.end_date,
                location=c.location,
                status=c.status,
                participant_count=int(counts.get(c.id, 0)),
            )
        )
    return out


@router.post("", response_model=CompetitionResponse, status_code=201)
async def create_competition(
    data: CompetitionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_organize_competition(current_user)

    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    comp = Competition(
        name=data.name,
        description=data.description,
        organizer_id=current_user.id,
        start_date=data.start_date,
        end_date=data.end_date,
        location=data.location,
        status="open",
    )
    db.add(comp)
    await db.flush()

    for g in data.groups:
        group = CompetitionGroup(
            competition_id=comp.id,
            name=g.name,
            age_from=g.age_from,
            age_to=g.age_to,
            stm_from=g.stm_from,
            stm_to=g.stm_to,
            max_participants=g.max_participants,
        )
        db.add(group)

    await db.commit()

    result = await db.execute(_load_competition_full(comp.id))
    return result.scalar_one()


@router.get("/{comp_id}", response_model=CompetitionResponse)
async def get_competition(
    comp_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_load_competition_full(comp_id))
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    return comp


@router.post("/{comp_id}/groups", response_model=CompetitionGroupResponse, status_code=201)
async def add_group(
    comp_id: uuid.UUID,
    data: CompetitionGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Competition).where(Competition.id == comp_id))
    comp = res.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if comp.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can add groups")

    group = CompetitionGroup(
        competition_id=comp_id,
        name=data.name,
        age_from=data.age_from,
        age_to=data.age_to,
        stm_from=data.stm_from,
        stm_to=data.stm_to,
        max_participants=data.max_participants,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group, ["participants"])
    return group


@router.post("/{comp_id}/register", response_model=CompetitionGroupResponse)
async def register_in_group(
    comp_id: uuid.UUID,
    data: RegisterPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register the current user in the chosen group of a competition."""
    res = await db.execute(
        select(CompetitionGroup)
        .where(CompetitionGroup.id == data.group_id, CompetitionGroup.competition_id == comp_id)
        .options(selectinload(CompetitionGroup.participants))
    )
    group = res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check existing
    existing_res = await db.execute(
        select(CompetitionParticipant).where(
            CompetitionParticipant.group_id == data.group_id,
            CompetitionParticipant.user_id == current_user.id,
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        if existing.status == "registered":
            raise HTTPException(status_code=409, detail="Already registered in this group")
        existing.status = "registered"
    else:
        # Capacity check
        if group.max_participants is not None:
            active = [p for p in group.participants if p.status == "registered"]
            if len(active) >= group.max_participants:
                raise HTTPException(status_code=409, detail="Group is full")
        p = CompetitionParticipant(
            competition_id=comp_id,
            group_id=data.group_id,
            user_id=current_user.id,
            status="registered",
        )
        db.add(p)

    await db.commit()

    res = await db.execute(
        select(CompetitionGroup)
        .where(CompetitionGroup.id == data.group_id)
        .options(
            selectinload(CompetitionGroup.participants)
            .selectinload(CompetitionParticipant.user)
        )
    )
    return res.scalar_one()


@router.post("/{comp_id}/invite-by-filter", response_model=dict)
async def invite_by_filter(
    comp_id: uuid.UUID,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mass-invite users matching age/STM filter to a specific group.

    Body: {group_id, age_min?, age_max?, stm_min?, stm_max?}
    Creates Notification for each matched user.
    """
    from datetime import date as date_cls

    from app.models.notification import Notification

    res = await db.execute(select(Competition).where(Competition.id == comp_id))
    comp = res.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if comp.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer")

    group_id = payload.get("group_id")
    if not group_id:
        raise HTTPException(status_code=400, detail="group_id required")

    g_res = await db.execute(
        select(CompetitionGroup).where(
            CompetitionGroup.id == uuid.UUID(group_id),
            CompetitionGroup.competition_id == comp_id,
        )
    )
    group = g_res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Pull filter, fall back to group bounds
    age_min = payload.get("age_min", group.age_from)
    age_max = payload.get("age_max", group.age_to)
    stm_min = payload.get("stm_min", float(group.stm_from) if group.stm_from else None)
    stm_max = payload.get("stm_max", float(group.stm_to) if group.stm_to else None)

    q = select(User).where(User.id != current_user.id)
    if stm_min is not None:
        q = q.where(User.stm_level.cast(__import__("sqlalchemy").Float) >= float(stm_min))
    if stm_max is not None:
        q = q.where(User.stm_level.cast(__import__("sqlalchemy").Float) <= float(stm_max))

    res = await db.execute(q)
    users = list(res.scalars().all())

    today = date_cls.today()

    def age_of(u):
        bd = u.date_of_birth
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))

    matched = []
    for u in users:
        a = age_of(u)
        if age_min is not None and a < int(age_min):
            continue
        if age_max is not None and a > int(age_max):
            continue
        matched.append(u)

    notif_text = (
        f"Приглашение на «{comp.name}» в группу «{group.name}». Откройте раздел Турниры."
    )
    sent = 0
    for u in matched:
        db.add(Notification(
            user_id=u.id,
            type="competition_invite",
            title=f"Приглашение: {comp.name}",
            body=notif_text,
            reference_type="competition",
            reference_id=comp_id,
        ))
        sent += 1

    await db.commit()
    return {"matched": len(matched), "sent": sent}


@router.delete("/{comp_id}/register/{group_id}", status_code=204)
async def unregister(
    comp_id: uuid.UUID,
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CompetitionParticipant).where(
            CompetitionParticipant.group_id == group_id,
            CompetitionParticipant.user_id == current_user.id,
            CompetitionParticipant.competition_id == comp_id,
        )
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Registration not found")
    p.status = "cancelled"
    await db.commit()
