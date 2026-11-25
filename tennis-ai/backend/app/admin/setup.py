from sqladmin import Admin, ModelView

from app.models.competition import Competition
from app.models.court_transfer import CourtTransfer
from app.models.game_score import GameScore
from app.models.location import Court, Location
from app.models.match import MatchSet
from app.models.notification import Notification
from app.models.player_request import PlayerAddRequest
from app.models.reference import NtrpStmLevel
from app.models.search import SearchRequest, SearchResponse
from app.models.training import Training
from app.models.user import User


class UserAdmin(ModelView, model=User):
    column_list = [
        User.id,
        User.last_name,
        User.first_name,
        User.nickname,
        User.phone_primary,
        User.stm_level,
        User.elo_rating,
        User.city,
        User.is_admin,
        User.trainer_status,
    ]
    column_searchable_list = [User.last_name, User.nickname, User.phone_primary]
    column_sortable_list = [User.last_name, User.created_at, User.elo_rating]
    can_delete = False


class LocationAdmin(ModelView, model=Location):
    column_list = [Location.id, Location.name, Location.city, Location.address, Location.is_active]
    column_searchable_list = [Location.name, Location.city]


class CourtAdmin(ModelView, model=Court):
    column_list = [
        Court.id,
        Court.name,
        Court.location_id,
        Court.sport,
        Court.court_type,
        Court.surface_type,
        Court.is_active,
    ]


class NtrpStmAdmin(ModelView, model=NtrpStmLevel):
    column_list = [NtrpStmLevel.id, NtrpStmLevel.ntrp, NtrpStmLevel.stm, NtrpStmLevel.description]
    can_delete = False


class SearchRequestAdmin(ModelView, model=SearchRequest):
    column_list = [
        SearchRequest.id,
        SearchRequest.author_id,
        SearchRequest.game_type,
        SearchRequest.start_time,
        SearchRequest.is_active,
    ]
    can_create = False
    can_edit = False


class MatchSetAdmin(ModelView, model=MatchSet):
    column_list = [
        MatchSet.id,
        MatchSet.creator_id,
        MatchSet.opponent_id,
        MatchSet.played_at,
        MatchSet.creator_games,
        MatchSet.opponent_games,
        MatchSet.status,
        MatchSet.created_at,
    ]
    can_create = False
    can_edit = False


class NotificationAdmin(ModelView, model=Notification):
    column_list = [
        Notification.id,
        Notification.user_id,
        Notification.type,
        Notification.title,
        Notification.is_read,
        Notification.created_at,
    ]
    can_create = False


class CompetitionAdmin(ModelView, model=Competition):
    column_list = [
        Competition.id,
        Competition.name,
        Competition.organizer_id,
        Competition.start_date,
        Competition.end_date,
        Competition.status,
        Competition.created_at,
    ]
    column_searchable_list = [Competition.name]
    column_sortable_list = [Competition.start_date, Competition.created_at]
    can_create = False
    can_edit = False


class GameScoreAdmin(ModelView, model=GameScore):
    column_list = [
        GameScore.id,
        GameScore.creator_id,
        GameScore.opponent_id,
        GameScore.played_at,
        GameScore.creator_points,
        GameScore.opponent_points,
        GameScore.status,
        GameScore.created_at,
    ]
    can_create = False
    can_edit = False


class TrainingAdmin(ModelView, model=Training):
    column_list = [
        Training.id,
        Training.title,
        Training.organizer_id,
        Training.trainer_id,
        Training.schedule_type,
        Training.start_time,
        Training.status,
        Training.created_at,
    ]
    column_searchable_list = [Training.title]
    column_sortable_list = [Training.start_time, Training.created_at]
    can_create = False
    can_edit = False


def setup_admin(app, engine):
    admin = Admin(app, engine)
    admin.add_view(UserAdmin)
    admin.add_view(LocationAdmin)
    admin.add_view(CourtAdmin)
    admin.add_view(NtrpStmAdmin)
    admin.add_view(SearchRequestAdmin)
    admin.add_view(MatchSetAdmin)
    admin.add_view(NotificationAdmin)
    admin.add_view(CompetitionAdmin)
    admin.add_view(GameScoreAdmin)
    admin.add_view(TrainingAdmin)
    return admin
