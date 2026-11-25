import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Share} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {formatFullName} from '../../utils/format';

export default function MyQRScreen({navigation}: any) {
  const user = useAuthStore(s => s.user);

  if (!user) return null;

  const qrValue = `tennisai://user/${user.id}`;

  const handleShare = async () => {
    await Share.share({
      message: `Добавь меня в TennisAI: @${user.nickname}`,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Покажи этот QR-код другому игроку,</Text>
      <Text style={styles.hint}>чтобы он добавил тебя в список соперников</Text>

      <View style={styles.qrCard}>
        <QRCode
          value={qrValue}
          size={220}
          backgroundColor={COLORS.surface}
          color={COLORS.text}
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.name}>
          {formatFullName(user.last_name, user.first_name, user.patronymic)}
        </Text>
        <Text style={styles.nickname}>@{user.nickname}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>STM {user.stm_level}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NTRP {user.ntrp_level}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ELO {user.elo_rating}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.scanBtn}
        onPress={() => navigation.navigate('QRScan')}>
        <Text style={styles.scanBtnText}>📷  Сканировать QR друга</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Поделиться ником</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    padding: SPACING.lg,
  },
  hint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  infoCard: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  name: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nickname: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.primary + '22',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scanBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.sm,
  },
  scanBtnText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  shareBtn: {
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
});
