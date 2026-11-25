from fastapi import APIRouter

from app.api.v1.activity_feed import router as feed_router
from app.api.v1.auth import router as auth_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.chat import router as chat_router
from app.api.v1.competitions import router as competitions_router
from app.api.v1.game_scores import router as game_scores_router
from app.api.v1.trainings import router as trainings_router
from app.api.v1.reports import router as reports_router
from app.api.v1.trainer_role import router as trainer_role_router
from app.api.v1.payments import router as payments_router
from app.api.v1.court_transfers import router as court_transfers_router
from app.api.v1.locations import router as locations_router
from app.api.v1.matches import router as matches_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.player_requests import router as player_requests_router
from app.api.v1.preferred_locations import router as preferred_locations_router
from app.api.v1.preferred_players import router as preferred_players_router
from app.api.v1.reference import router as reference_router
from app.api.v1.search_requests import router as search_requests_router
from app.api.v1.users import router as users_router
from app.api.v1.cash import router as cash_router
from app.api.v1.subscriptions import router as subscriptions_router
from app.api.v1.queue import router as queue_router
from app.api.v1.equipment import router as equipment_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(locations_router)
api_router.include_router(preferred_locations_router)
api_router.include_router(preferred_players_router)
api_router.include_router(player_requests_router)
api_router.include_router(search_requests_router)
api_router.include_router(court_transfers_router)
api_router.include_router(matches_router)
api_router.include_router(feed_router)
api_router.include_router(notifications_router)
api_router.include_router(reference_router)
api_router.include_router(bookings_router)
api_router.include_router(chat_router)
api_router.include_router(competitions_router)
api_router.include_router(game_scores_router)
api_router.include_router(trainings_router)
api_router.include_router(reports_router)
api_router.include_router(trainer_role_router)
api_router.include_router(payments_router)
api_router.include_router(cash_router)
api_router.include_router(subscriptions_router)
api_router.include_router(queue_router)
api_router.include_router(equipment_router)
api_router.include_router(analytics_router)
