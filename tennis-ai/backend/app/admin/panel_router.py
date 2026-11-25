from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from jose import JWTError, jwt
from sqlalchemy import func, select

from app.config import settings
from app.database import async_session
from app.models.booking import CourtBooking
from app.models.competition import Competition
from app.models.location import Location
from app.models.match import MatchSet
from app.models.search import SearchRequest
from app.models.training import Training
from app.models.user import User
from app.utils.security import verify_password

router = APIRouter(prefix="/panel", tags=["admin-panel"])

_TEMPLATES_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATES_DIR))

COOKIE_NAME = "admin_session"
COOKIE_MAX_AGE = 8 * 3600  # 8 hours in seconds


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_admin_token(user_id: str, nickname: str, full_name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {
        "sub": user_id,
        "nickname": nickname,
        "full_name": full_name,
        "is_admin": True,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode_admin_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if not payload.get("is_admin"):
            return None
        return payload
    except JWTError:
        return None


def _get_current_admin(request: Request) -> Optional[dict]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return _decode_admin_token(token)


def _require_admin(request: Request) -> dict:
    admin = _get_current_admin(request)
    if not admin:
        # Will be caught in route handler
        return None
    return admin


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    admin = _get_current_admin(request)
    if admin:
        return RedirectResponse(url="/panel/", status_code=302)
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    phone: str = Form(...),
    password: str = Form(...),
):
    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.phone_primary == phone)
        )
        user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Неверный телефон или пароль"},
            status_code=401,
        )

    if not user.is_admin:
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Нет прав администратора"},
            status_code=403,
        )

    full_name = f"{user.last_name} {user.first_name}".strip()
    token = _create_admin_token(str(user.id), user.nickname, full_name)

    response = RedirectResponse(url="/panel/", status_code=302)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/panel/login", status_code=302)
    response.delete_cookie(COOKIE_NAME)
    return response


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    async with async_session() as db:
        # Total users
        total_users = (await db.execute(select(func.count(User.id)))).scalar_one()

        # New today
        new_today = (
            await db.execute(
                select(func.count(User.id)).where(
                    User.created_at >= today_start,
                    User.created_at < today_end,
                )
            )
        ).scalar_one()

        # Active searches right now
        active_searches = (
            await db.execute(
                select(func.count(SearchRequest.id)).where(SearchRequest.is_active == True)
            )
        ).scalar_one()

        # Bookings today
        bookings_today = (
            await db.execute(
                select(func.count(CourtBooking.id)).where(CourtBooking.date == today)
            )
        ).scalar_one()

        # Pending trainer applications
        pending_trainers = (
            await db.execute(
                select(func.count(User.id)).where(User.trainer_status == "pending")
            )
        ).scalar_one()

        # Total matches
        total_matches = (await db.execute(select(func.count(MatchSet.id)))).scalar_one()

        # Total competitions
        total_competitions = (await db.execute(select(func.count(Competition.id)))).scalar_one()

        # Total trainings
        total_trainings = (await db.execute(select(func.count(Training.id)))).scalar_one()

        # Last 10 registrations
        last_users_result = await db.execute(
            select(User).order_by(User.created_at.desc()).limit(10)
        )
        last_users = last_users_result.scalars().all()

        # Pending trainer applications (with data)
        pending_apps_result = await db.execute(
            select(User)
            .where(User.trainer_status == "pending")
            .order_by(User.created_at.asc())
            .limit(5)
        )
        pending_apps = pending_apps_result.scalars().all()

    stats = {
        "total_users": total_users,
        "new_today": new_today,
        "active_searches": active_searches,
        "bookings_today": bookings_today,
        "pending_trainers": pending_trainers,
        "total_matches": total_matches,
        "total_competitions": total_competitions,
        "total_trainings": total_trainings,
    }

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "admin": admin,
            "stats": stats,
            "last_users": last_users,
            "pending_apps": pending_apps,
        },
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users", response_class=HTMLResponse)
async def users_list(request: Request, q: Optional[str] = None, page: int = 1):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    limit = 50
    offset = (page - 1) * limit

    async with async_session() as db:
        query = select(User).order_by(User.created_at.desc())
        count_query = select(func.count(User.id))

        if q and q.strip():
            q_stripped = q.strip()
            like_pattern = f"%{q_stripped}%"
            from sqlalchemy import or_
            filter_cond = or_(
                User.last_name.ilike(like_pattern),
                User.first_name.ilike(like_pattern),
                User.nickname.ilike(like_pattern),
                User.phone_primary.ilike(like_pattern),
                User.city.ilike(like_pattern),
            )
            query = query.where(filter_cond)
            count_query = count_query.where(filter_cond)

        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.offset(offset).limit(limit))
        users = result.scalars().all()

    total_pages = max(1, (total + limit - 1) // limit)

    return templates.TemplateResponse(
        "users.html",
        {
            "request": request,
            "admin": admin,
            "users": users,
            "q": q or "",
            "page": page,
            "total": total,
            "total_pages": total_pages,
        },
    )


# ---------------------------------------------------------------------------
# Trainer applications
# ---------------------------------------------------------------------------

@router.get("/trainer-applications", response_class=HTMLResponse)
async def trainer_applications(request: Request):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    async with async_session() as db:
        result = await db.execute(
            select(User)
            .where(User.trainer_status == "pending")
            .order_by(User.created_at.asc())
        )
        applicants = result.scalars().all()

        # Also get recently reviewed
        reviewed_result = await db.execute(
            select(User)
            .where(User.trainer_status.in_(["approved", "rejected"]))
            .order_by(User.created_at.desc())
            .limit(20)
        )
        reviewed = reviewed_result.scalars().all()

    return templates.TemplateResponse(
        "trainer_applications.html",
        {
            "request": request,
            "admin": admin,
            "applicants": applicants,
            "reviewed": reviewed,
        },
    )


@router.post("/trainer-applications/{user_id}/approve")
async def approve_trainer(user_id: str, request: Request):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    import uuid as _uuid
    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.id == _uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if user:
            user.trainer_status = "approved"
            await db.commit()

    return RedirectResponse(url="/panel/trainer-applications", status_code=302)


@router.post("/trainer-applications/{user_id}/reject")
async def reject_trainer(user_id: str, request: Request):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    import uuid as _uuid
    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.id == _uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if user:
            user.trainer_status = "rejected"
            await db.commit()

    return RedirectResponse(url="/panel/trainer-applications", status_code=302)


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------

@router.get("/locations", response_class=HTMLResponse)
async def locations_list(request: Request):
    admin = _get_current_admin(request)
    if not admin:
        return RedirectResponse(url="/panel/login", status_code=302)

    async with async_session() as db:
        from app.models.location import Court
        result = await db.execute(
            select(Location).order_by(Location.city, Location.name)
        )
        locations = result.scalars().all()

        # Count courts per location
        courts_count_result = await db.execute(
            select(Court.location_id, func.count(Court.id).label("cnt"))
            .group_by(Court.location_id)
        )
        courts_count = {str(row.location_id): row.cnt for row in courts_count_result}

    return templates.TemplateResponse(
        "locations.html",
        {
            "request": request,
            "admin": admin,
            "locations": locations,
            "courts_count": courts_count,
        },
    )
