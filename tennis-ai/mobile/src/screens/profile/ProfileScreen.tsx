import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatDate, formatFullName} from '../../utils/format';

export default function ProfileScreen({navigation}: any) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  if (!user) return null;

  const InfoRow = ({label, value}: {label: string; value: string | null | undefined}) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.first_name[0]}{user.last_name[0]}
          </Text>
        </View>
        <Text style={styles.name}>
          {formatFullName(user.last_name, user.first_name, user.patronymic)}
        </Text>
        <Text style={styles.nickname}>@{user.nickname}</Text>
        {user.is_premium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>👑 Premium</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.editProfileBtn}
        onPress={() => navigation.navigate('EditProfile')}>
        <Text style={styles.editProfileBtnText}>✏️ Редактировать профиль</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <InfoRow label="Телефон" value={user.phone_primary} />
        <InfoRow label="Город" value={user.city} />
        <InfoRow label="Дата рождения" value={formatDate(user.date_of_birth)} />
        <InfoRow label="Пол" value={user.gender === 'M' ? 'Мужчина' : 'Женщина'} />
        <InfoRow label="Играет лет" value={String(user.years_playing)} />
        <InfoRow label="СТМ" value={user.stm_level} />
        <InfoRow label="NTRP" value={user.ntrp_level} />
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('PreferredPlayers')}>
        <Text style={styles.menuText}>👥 Друзья</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('PreferredLocations')}>
        <Text style={styles.menuText}>Предпочитаемые локации</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.menuText}>Настройки и фильтры</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, styles.premiumMenuItem]}
        onPress={() => navigation.navigate('Premium')}>
        <Text style={styles.menuText}>👑 Premium-подписка</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('TrainerRole')}>
        <Text style={styles.menuText}>👨‍🏫 Стать тренером</Text>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      {user.is_admin && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AdminTrainerApplications')}>
          <Text style={styles.menuText}>🛡 Заявки тренеров (админ)</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  avatarContainer: {alignItems: 'center', marginBottom: SPACING.lg},
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  avatarText: {fontSize: FONT_SIZE.xxl, color: COLORS.textLight, fontWeight: 'bold'},
  name: {fontSize: FONT_SIZE.xl, fontWeight: 'bold', color: COLORS.text},
  nickname: {fontSize: FONT_SIZE.md, color: COLORS.textSecondary},
  card: {backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md},
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLabel: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary},
  rowValue: {fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500'},
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  menuText: {fontSize: FONT_SIZE.md, color: COLORS.text},
  menuArrow: {fontSize: FONT_SIZE.xl, color: COLORS.disabled},
  logoutBtn: {
    padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: COLORS.error,
    alignItems: 'center', marginTop: SPACING.md,
  },
  logoutText: {color: COLORS.error, fontSize: FONT_SIZE.md, fontWeight: '600'},
  premiumBadge: {
    marginTop: 6,
    backgroundColor: '#3a2800',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  premiumBadgeText: {color: '#F5A623', fontWeight: '700', fontSize: 13},
  premiumMenuItem: {
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  editProfileBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editProfileBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
});
