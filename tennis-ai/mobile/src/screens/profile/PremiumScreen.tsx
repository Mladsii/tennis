import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {paymentsApi, PremiumStatusResponse} from '../../api/payments';

const FEATURES_FREE = [
  {icon: '🔍', text: 'До 2 активных заявок поиска'},
  {icon: '👥', text: 'До 15 друзей'},
  {icon: '📊', text: 'Отчёты за 7 дней'},
  {icon: '🏆', text: 'Соревнования: только участие'},
  {icon: '💬', text: 'Чат и уведомления'},
];

const FEATURES_PREMIUM = [
  {icon: '🔍', text: 'Безлимитные заявки поиска'},
  {icon: '👥', text: 'Безлимитный список игроков'},
  {icon: '📊', text: 'Отчёты за 90 дней'},
  {icon: '🏆', text: 'Организация соревнований'},
  {icon: '⭐', text: 'Значок Premium в профиле'},
  {icon: '🚀', text: 'Приоритет в поиске партнёров'},
];

export default function PremiumScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<PremiumStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await paymentsApi.getStatus();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
  }, [fetchStatus]);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const {confirmation_url} = await paymentsApi.createSubscription();
      // Открываем ЮКасса в браузере
      await Linking.openURL(confirmation_url);
      // После открытия начинаем поллинг статуса
      startPolling();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось создать платёж');
    } finally {
      setBuying(false);
    }
  };

  const startPolling = () => {
    setPolling(true);
    Alert.alert(
      'Оплата открыта',
      'Завершите оплату в браузере. После успешной оплаты нажмите «Проверить статус».',
      [
        {
          text: 'Проверить статус',
          onPress: async () => {
            const s = await fetchStatus();
            if (s?.is_premium) {
              Alert.alert('🌟 Готово!', 'Premium успешно активирован!');
            } else {
              Alert.alert('Ожидание', 'Платёж ещё не подтверждён. Подождите немного и проверьте снова.');
            }
            setPolling(false);
          },
        },
        {
          text: 'Закрыть',
          style: 'cancel',
          onPress: () => setPolling(false),
        },
      ],
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'});
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  const isPremium = status?.is_premium;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.title}>TennisAI Premium</Text>
        <Text style={styles.subtitle}>Раскройте весь потенциал игры</Text>
      </View>

      {/* Current status */}
      {isPremium ? (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>✅ Premium активен</Text>
          {status?.expires_at && (
            <Text style={styles.activeBadgeSub}>
              До {formatDate(status.expires_at)} · ещё {status.days_left} дн.
            </Text>
          )}
        </View>
      ) : null}

      {/* Pricing card */}
      {!isPremium && (
        <View style={styles.priceCard}>
          <Text style={styles.pricePeriod}>1 месяц</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>199</Text>
            <Text style={styles.priceCurrency}>₽</Text>
          </View>
          <Text style={styles.priceSub}>≈ 6.6 ₽ в день</Text>
        </View>
      )}

      {/* Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Бесплатный план</Text>
        {FEATURES_FREE.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureTextFree}>{f.text}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, styles.sectionPremium]}>
        <Text style={styles.sectionTitle}>
          👑 Premium
        </Text>
        {FEATURES_PREMIUM.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureTextPremium}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      {!isPremium ? (
        <TouchableOpacity
          style={[styles.buyBtn, buying && styles.buyBtnDisabled]}
          onPress={handleBuy}
          disabled={buying}>
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buyBtnText}>Оформить Premium — 199 ₽/мес</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.renewBtn} onPress={handleBuy} disabled={buying}>
          {buying ? (
            <ActivityIndicator color="#F5A623" />
          ) : (
            <Text style={styles.renewBtnText}>Продлить подписку</Text>
          )}
        </TouchableOpacity>
      )}

      {polling && (
        <TouchableOpacity
          style={styles.checkBtn}
          onPress={async () => {
            const s = await fetchStatus();
            if (s?.is_premium) {
              Alert.alert('🌟 Готово!', 'Premium успешно активирован!');
            } else {
              Alert.alert('Ожидание', 'Платёж ещё обрабатывается...');
            }
          }}>
          <Text style={styles.checkBtnText}>Проверить статус оплаты</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.disclaimer}>
        Оплата через ЮКасса. После оплаты Premium активируется автоматически.{'\n'}
        Подписка не продлевается автоматически.
      </Text>
    </ScrollView>
  );
}

const GOLD = '#F5A623';
const DARK = '#1a1a2e';
const CARD = '#16213e';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 12,
  },
  crown: {
    fontSize: 52,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#aaa',
    marginTop: 4,
  },
  activeBadge: {
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  activeBadgeText: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: '700',
  },
  activeBadgeSub: {
    color: '#80c880',
    fontSize: 13,
    marginTop: 4,
  },
  priceCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GOLD,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  pricePeriod: {
    color: '#aaa',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceAmount: {
    fontSize: 56,
    fontWeight: '900',
    color: GOLD,
    lineHeight: 60,
  },
  priceCurrency: {
    fontSize: 26,
    fontWeight: '700',
    color: GOLD,
    marginTop: 8,
    marginLeft: 4,
  },
  priceSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionPremium: {
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 18,
    width: 30,
  },
  featureTextFree: {
    color: '#888',
    fontSize: 14,
    flex: 1,
  },
  featureTextPremium: {
    color: '#e0e0e0',
    fontSize: 14,
    flex: 1,
  },
  buyBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buyBtnDisabled: {
    opacity: 0.6,
  },
  buyBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  renewBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: GOLD,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  renewBtnText: {
    color: GOLD,
    fontWeight: '700',
    fontSize: 15,
  },
  checkBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkBtnText: {
    color: '#aaa',
    fontSize: 14,
  },
  disclaimer: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});
