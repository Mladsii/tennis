import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS} from '../constants/theme';

// Feed
import ActivityFeedScreen from '../screens/feed/ActivityFeedScreen';

// Search
import MySearchesScreen from '../screens/search/MySearchesScreen';
import CreateSearchScreen from '../screens/search/CreateSearchScreen';
import SearchRequestDetailScreen from '../screens/search/SearchRequestDetailScreen';
import EditSearchScreen from '../screens/search/EditSearchScreen';

// Court Transfer
import MyCourtTransfersScreen from '../screens/courtTransfer/MyCourtTransfersScreen';
import CreateCourtTransferScreen from '../screens/courtTransfer/CreateCourtTransferScreen';
import CourtTransferDetailScreen from '../screens/courtTransfer/CourtTransferDetailScreen';

// Courts Home
import CourtsHomeScreen from '../screens/courts/CourtsHomeScreen';

// Courts / Grid
import LocationListScreen from '../screens/courts/LocationListScreen';
import CourtGridScreen from '../screens/courts/CourtGridScreen';
import MyQueueScreen from '../screens/courts/MyQueueScreen';

// Competitions
import CompetitionsListScreen from '../screens/competitions/CompetitionsListScreen';
import CreateCompetitionScreen from '../screens/competitions/CreateCompetitionScreen';
import CompetitionDetailScreen from '../screens/competitions/CompetitionDetailScreen';

// Game scores
import MyGameScoresScreen from '../screens/gameScores/MyGameScoresScreen';
import CreateGameScoreScreen from '../screens/gameScores/CreateGameScoreScreen';
import GameScoreDetailScreen from '../screens/gameScores/GameScoreDetailScreen';

// Trainings
import TrainingsListScreen from '../screens/trainings/TrainingsListScreen';
import CreateTrainingScreen from '../screens/trainings/CreateTrainingScreen';
import TrainingDetailScreen from '../screens/trainings/TrainingDetailScreen';

// Reports
import ReportsScreen from '../screens/reports/ReportsScreen';

// Players
import PreferredPlayersScreen from '../screens/players/PreferredPlayersScreen';
import AddPlayerScreen from '../screens/players/AddPlayerScreen';
import MyQRScreen from '../screens/players/MyQRScreen';
import QRScanScreen from '../screens/players/QRScanScreen';
import PlayerProfileScreen from '../screens/players/PlayerProfileScreen';

// Matches
import MyMatchesScreen from '../screens/matches/MyMatchesScreen';
import CreateMatchScreen from '../screens/matches/CreateMatchScreen';
import MatchDetailScreen from '../screens/matches/MatchDetailScreen';
import RankingsScreen from '../screens/matches/RankingsScreen';

// Profile
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PreferredLocationsScreen from '../screens/profile/PreferredLocationsScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import TrainerRoleScreen from '../screens/profile/TrainerRoleScreen';
import AdminTrainerApplicationsScreen from '../screens/profile/AdminTrainerApplicationsScreen';
import PremiumScreen from '../screens/profile/PremiumScreen';

// Chat
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';

// --- Stack param lists ---

export type FeedStackParamList = {
  ActivityFeed: undefined;
};

export type SearchStackParamList = {
  MySearches: undefined;
  CreateSearch: undefined;
  SearchRequestDetail: {id: string};
  EditSearch: {searchRequest: any};
  CreateMatch: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
  CreateGameScore: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
};

export type CourtTransferStackParamList = {
  CourtsHome: undefined;
  MyCourtTransfers: undefined;
  CreateCourtTransfer: {bookingId?: string; courtName?: string; date?: string; slotStart?: string; slotEnd?: string; locationId?: string} | undefined;
  CourtTransferDetail: {id: string};
  LocationList: undefined;
  CourtGrid: {locationId: string; locationName: string};
  PlayerProfile: {userId: string};
  MyQueue: undefined;
};

export type PlayersStackParamList = {
  PreferredPlayers: undefined;
  AddPlayer: undefined;
  MyQR: undefined;
  QRScan: undefined;
  MyMatches: undefined;
  CreateMatch: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
  MatchDetail: {id: string};
  Rankings: undefined;
  PlayerProfile: {userId: string};
  CompetitionsList: undefined;
  CreateCompetition: undefined;
  CompetitionDetail: {id: string};
  MyGameScores: undefined;
  CreateGameScore: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
  GameScoreDetail: {id: string};
  TrainingsList: undefined;
  CreateTraining: undefined;
  TrainingDetail: {id: string};
  Reports: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  PreferredLocations: undefined;
  Settings: undefined;
  TrainerRole: undefined;
  AdminTrainerApplications: undefined;
  Premium: undefined;
  PreferredPlayers: undefined;
  AddPlayer: undefined;
  MyQR: undefined;
  QRScan: undefined;
  PlayerProfile: {userId: string};
  MyMatches: undefined;
  CreateMatch: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
  MatchDetail: {id: string};
  Rankings: undefined;
  CompetitionsList: undefined;
  CreateCompetition: undefined;
  CompetitionDetail: {id: string};
  MyGameScores: undefined;
  CreateGameScore: {opponentId?: string; opponentName?: string; playedAt?: string} | undefined;
  GameScoreDetail: {id: string};
  TrainingsList: undefined;
  CreateTraining: undefined;
  TrainingDetail: {id: string};
  Reports: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  Chat: {conversationId: string; peerName?: string};
};

// --- Stack navigators ---

const FeedStack = createNativeStackNavigator<FeedStackParamList>();
function FeedNavigator() {
  return (
    <FeedStack.Navigator>
      <FeedStack.Screen
        name="ActivityFeed"
        component={ActivityFeedScreen}
        options={{title: 'Главная'}}
      />
    </FeedStack.Navigator>
  );
}

const BackButton = ({onPress}: {onPress: () => void}) => (
  <TouchableOpacity onPress={onPress} style={{paddingRight: 8}}>
    <Text style={{fontSize: 28, color: COLORS.primary, lineHeight: 32}}>‹</Text>
  </TouchableOpacity>
);

const SearchStack = createNativeStackNavigator<SearchStackParamList>();
function SearchNavigator() {
  return (
    <SearchStack.Navigator
      screenOptions={({navigation}) => ({
        headerBackVisible: false,
        headerLeft: navigation.canGoBack()
          ? () => <BackButton onPress={() => navigation.goBack()} />
          : undefined,
      })}>
      <SearchStack.Screen
        name="MySearches"
        component={MySearchesScreen}
        options={{title: 'Поиск партнера'}}
      />
      <SearchStack.Screen
        name="CreateSearch"
        component={CreateSearchScreen}
        options={{title: 'Новый поиск', headerShown: false}}
      />
      <SearchStack.Screen
        name="SearchRequestDetail"
        component={SearchRequestDetailScreen}
        options={{title: 'Детали поиска'}}
      />
      <SearchStack.Screen
        name="EditSearch"
        component={EditSearchScreen}
        options={{title: 'Редактировать поиск'}}
      />
      <SearchStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{title: 'Записать счёт игры'}}
      />
      <SearchStack.Screen
        name="CreateGameScore"
        component={CreateGameScoreScreen}
        options={{title: 'Записать счёт гейма'}}
      />
    </SearchStack.Navigator>
  );
}

const CourtTransferStack = createNativeStackNavigator<CourtTransferStackParamList>();
function CourtTransferNavigator() {
  return (
    <CourtTransferStack.Navigator initialRouteName="CourtsHome">
      <CourtTransferStack.Screen
        name="CourtsHome"
        component={CourtsHomeScreen}
        options={{headerShown: false}}
      />
      <CourtTransferStack.Screen
        name="MyCourtTransfers"
        component={MyCourtTransfersScreen}
        options={{title: 'Передача корта'}}
      />
      <CourtTransferStack.Screen
        name="CreateCourtTransfer"
        component={CreateCourtTransferScreen}
        options={{title: 'Новая передача'}}
      />
      <CourtTransferStack.Screen
        name="CourtTransferDetail"
        component={CourtTransferDetailScreen}
        options={{title: 'Детали корта'}}
      />
      <CourtTransferStack.Screen
        name="LocationList"
        component={LocationListScreen}
        options={{title: 'Выбор локации'}}
      />
      <CourtTransferStack.Screen
        name="CourtGrid"
        component={CourtGridScreen}
        options={({route}: any) => ({title: route.params?.locationName ?? 'Шахматка'})}
      />
      <CourtTransferStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{title: 'Профиль игрока'}}
      />
      <CourtTransferStack.Screen
        name="MyQueue"
        component={MyQueueScreen}
        options={{title: 'Моя очередь'}}
      />
    </CourtTransferStack.Navigator>
  );
}

const PlayersStack = createNativeStackNavigator<PlayersStackParamList>();
function PlayersNavigator() {
  return (
    <PlayersStack.Navigator>
      <PlayersStack.Screen
        name="PreferredPlayers"
        component={PreferredPlayersScreen}
        options={{title: 'Друзья'}}
      />
      <PlayersStack.Screen
        name="AddPlayer"
        component={AddPlayerScreen}
        options={{title: 'Добавить игрока'}}
      />
      <PlayersStack.Screen
        name="MyQR"
        component={MyQRScreen}
        options={{title: 'Мой QR-код'}}
      />
      <PlayersStack.Screen
        name="QRScan"
        component={QRScanScreen}
        options={{title: 'Сканировать QR'}}
      />
      <PlayersStack.Screen
        name="MyMatches"
        component={MyMatchesScreen}
        options={{title: 'Мои матчи'}}
      />
      <PlayersStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{title: 'Записать счёт игры'}}
      />
      <PlayersStack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{title: 'Матч'}}
      />
      <PlayersStack.Screen
        name="Rankings"
        component={RankingsScreen}
        options={{title: 'Рейтинг Elo'}}
      />
      <PlayersStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{title: 'Профиль игрока'}}
      />
      <PlayersStack.Screen
        name="CompetitionsList"
        component={CompetitionsListScreen}
        options={{title: 'Соревнования'}}
      />
      <PlayersStack.Screen
        name="CreateCompetition"
        component={CreateCompetitionScreen}
        options={{title: 'Новое соревнование'}}
      />
      <PlayersStack.Screen
        name="CompetitionDetail"
        component={CompetitionDetailScreen}
        options={{title: 'Соревнование'}}
      />
      <PlayersStack.Screen
        name="MyGameScores"
        component={MyGameScoresScreen}
        options={{title: 'Геймы'}}
      />
      <PlayersStack.Screen
        name="CreateGameScore"
        component={CreateGameScoreScreen}
        options={{title: 'Записать счёт гейма'}}
      />
      <PlayersStack.Screen
        name="GameScoreDetail"
        component={GameScoreDetailScreen}
        options={{title: 'Гейм'}}
      />
      <PlayersStack.Screen
        name="TrainingsList"
        component={TrainingsListScreen}
        options={{title: 'Тренировки'}}
      />
      <PlayersStack.Screen
        name="CreateTraining"
        component={CreateTrainingScreen}
        options={{title: 'Новая тренировка'}}
      />
      <PlayersStack.Screen
        name="TrainingDetail"
        component={TrainingDetailScreen}
        options={{title: 'Тренировка'}}
      />
      <PlayersStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{title: 'Прогресс'}}
      />
    </PlayersStack.Navigator>
  );
}

const ChatStack = createNativeStackNavigator<ChatStackParamList>();
function ChatNavigator() {
  return (
    <ChatStack.Navigator
      screenOptions={({navigation}) => ({
        headerBackVisible: false,
        headerLeft: navigation.canGoBack()
          ? () => <BackButton onPress={() => navigation.goBack()} />
          : undefined,
      })}>
      <ChatStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{title: 'Чат'}}
      />
      <ChatStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{title: 'Чат'}}
      />
    </ChatStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{headerBackVisible: true, headerBackTitle: 'Назад'}}>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: 'Профиль'}}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{title: 'Редактировать профиль'}}
      />
      <ProfileStack.Screen
        name="PreferredLocations"
        component={PreferredLocationsScreen}
        options={{title: 'Локации'}}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Настройки'}}
      />
      <ProfileStack.Screen
        name="TrainerRole"
        component={TrainerRoleScreen}
        options={{title: 'Роль тренера'}}
      />
      <ProfileStack.Screen
        name="AdminTrainerApplications"
        component={AdminTrainerApplicationsScreen}
        options={{title: 'Заявки тренеров'}}
      />
      <ProfileStack.Screen
        name="Premium"
        component={PremiumScreen}
        options={{title: 'Premium'}}
      />
      <ProfileStack.Screen
        name="PreferredPlayers"
        component={PreferredPlayersScreen}
        options={{title: 'Друзья'}}
      />
      <ProfileStack.Screen
        name="AddPlayer"
        component={AddPlayerScreen}
        options={{title: 'Добавить игрока'}}
      />
      <ProfileStack.Screen
        name="MyQR"
        component={MyQRScreen}
        options={{title: 'Мой QR-код'}}
      />
      <ProfileStack.Screen
        name="QRScan"
        component={QRScanScreen}
        options={{title: 'Сканировать QR'}}
      />
      <ProfileStack.Screen
        name="PlayerProfile"
        component={PlayerProfileScreen}
        options={{title: 'Профиль игрока'}}
      />
      <ProfileStack.Screen
        name="MyMatches"
        component={MyMatchesScreen}
        options={{title: 'Мои матчи'}}
      />
      <ProfileStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{title: 'Записать счёт'}}
      />
      <ProfileStack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{title: 'Матч'}}
      />
      <ProfileStack.Screen
        name="Rankings"
        component={RankingsScreen}
        options={{title: 'Рейтинг'}}
      />
      <ProfileStack.Screen
        name="CompetitionsList"
        component={CompetitionsListScreen}
        options={{title: 'Турниры'}}
      />
      <ProfileStack.Screen
        name="CreateCompetition"
        component={CreateCompetitionScreen}
        options={{title: 'Новый турнир'}}
      />
      <ProfileStack.Screen
        name="CompetitionDetail"
        component={CompetitionDetailScreen}
        options={{title: 'Турнир'}}
      />
      <ProfileStack.Screen
        name="MyGameScores"
        component={MyGameScoresScreen}
        options={{title: 'Счёт геймов'}}
      />
      <ProfileStack.Screen
        name="CreateGameScore"
        component={CreateGameScoreScreen}
        options={{title: 'Новый счёт'}}
      />
      <ProfileStack.Screen
        name="GameScoreDetail"
        component={GameScoreDetailScreen}
        options={{title: 'Детали счёта'}}
      />
      <ProfileStack.Screen
        name="TrainingsList"
        component={TrainingsListScreen}
        options={{title: 'Тренировки'}}
      />
      <ProfileStack.Screen
        name="CreateTraining"
        component={CreateTrainingScreen}
        options={{title: 'Новая тренировка'}}
      />
      <ProfileStack.Screen
        name="TrainingDetail"
        component={TrainingDetailScreen}
        options={{title: 'Тренировка'}}
      />
      <ProfileStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{title: 'Отчёты и рейтинг'}}
      />
    </ProfileStack.Navigator>
  );
}

// --- Bottom Tabs ---

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + insets.bottom;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600', marginTop: 2},
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -4},
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
      }}>
      <Tab.Screen
        name="HomeTab"
        component={FeedNavigator}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: ({focused, color}) => (
            <Icon name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CourtsTab"
        component={CourtTransferNavigator}
        options={{
          tabBarLabel: 'Корты',
          tabBarIcon: ({focused, color}) => (
            <Icon name={focused ? 'tennisball' : 'tennisball-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchNavigator}
        options={{
          tabBarLabel: 'Игра',
          tabBarIcon: ({focused, color}) => (
            <Icon name={focused ? 'search' : 'search-outline'} size={22} color={color} />
          ),
        }}
        listeners={({navigation}) => ({
          tabPress: () => {
            navigation.navigate('SearchTab', {screen: 'MySearches'});
          },
        })}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatNavigator}
        options={{
          tabBarLabel: 'Чат',
          tabBarIcon: ({focused, color}) => (
            <Icon name={focused ? 'chatbubble' : 'chatbubble-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({focused, color}) => (
            <Icon name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
        listeners={({navigation}) => ({
          tabPress: () => {
            navigation.navigate('ProfileTab', {screen: 'Profile'});
          },
        })}
      />
    </Tab.Navigator>
  );
}
