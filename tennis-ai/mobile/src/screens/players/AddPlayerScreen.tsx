import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {playerRequestApi} from '../../api/feed';
import {usersApi} from '../../api/users';
import {UserPublic} from '../../types/user';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';

type Mode = 'phone' | 'nickname';

export default function AddPlayerScreen({navigation}: any) {
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // ---- Phone mode ----
  const handleSendByPhone = async () => {
    if (!phone.trim()) {
      Alert.alert('Ошибка', 'Укажите номер телефона');
      return;
    }
    setLoading(true);
    try {
      const {data} = await playerRequestApi.create(phone.trim());
      if (data.target_user_id) {
        Alert.alert('Готово', 'Запрос отправлен игроку. Ожидайте подтверждения.');
        navigation.goBack();
      } else {
        Alert.alert('Не найден', 'Пользователь с таким номером не зарегистрирован.');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось отправить запрос'));
    } finally {
      setLoading(false);
    }
  };

  // ---- Nickname mode ----
  const handleSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      Alert.alert('Слишком коротко', 'Введите минимум 2 символа');
      return;
    }
    setSearching(true);
    setResults([]);
    try {
      const {data} = await usersApi.searchByNickname(q);
      setResults(data);
      if (data.length === 0) {
        Alert.alert('Не найдено', 'Игроки с таким ником не найдены');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Ошибка поиска'));
    } finally {
      setSearching(false);
    }
  };

  const handleSendToUser = async (user: UserPublic) => {
    setLoading(true);
    try {
      await playerRequestApi.create(user.id); // передаём user_id напрямую
      Alert.alert('Готово', `Запрос отправлен ${user.last_name} ${user.first_name}`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось отправить запрос'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
          onPress={() => { setMode('phone'); setResults([]); }}>
          <Text style={[styles.modeBtnText, mode === 'phone' && styles.modeBtnTextActive]}>
            📞 По телефону
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'nickname' && styles.modeBtnActive]}
          onPress={() => { setMode('nickname'); setResults([]); }}>
          <Text style={[styles.modeBtnText, mode === 'nickname' && styles.modeBtnTextActive]}>
            🔍 По нику / имени
          </Text>
        </TouchableOpacity>
      </View>

      {/* Phone mode */}
      {mode === 'phone' && (
        <View style={styles.formBlock}>
          <Text style={styles.desc}>
            Введите номер телефона игрока. Ему придёт запрос в друзья.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="+7 900 000 00 00"
            placeholderTextColor={COLORS.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoFocus={mode === 'phone'}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.disabled]}
            onPress={handleSendByPhone}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.textLight} />
            ) : (
              <Text style={styles.buttonText}>Отправить запрос</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Nickname mode */}
      {mode === 'nickname' && (
        <View style={styles.formBlock}>
          <Text style={styles.desc}>
            Введите никнейм или часть имени игрока.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, {flex: 1, marginBottom: 0}]}
              placeholder="Никнейм или имя..."
              placeholderTextColor={COLORS.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus={mode === 'nickname'}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchBtn, searching && styles.disabled]}
              onPress={handleSearch}
              disabled={searching}>
              {searching ? (
                <ActivityIndicator color={COLORS.textLight} size="small" />
              ) : (
                <Text style={styles.searchBtnText}>Найти</Text>
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={results}
            keyExtractor={u => u.id}
            style={styles.resultList}
            renderItem={({item}) => (
              <View style={styles.resultCard}>
                <View style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>
                    {(item.first_name[0] ?? '') + (item.last_name[0] ?? '')}
                  </Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>
                    {item.last_name} {item.first_name}
                  </Text>
                  <Text style={styles.resultMeta}>
                    @{item.nickname}  ·  СТМ {item.stm_level}  ·  Elo {item.elo_rating}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, loading && styles.disabled]}
                  onPress={() => handleSendToUser(item)}
                  disabled={loading}>
                  <Text style={styles.addBtnText}>+ Добавить</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={null}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  modeRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeBtnActive: {borderBottomColor: COLORS.primary},
  modeBtnText: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600'},
  modeBtnTextActive: {color: COLORS.primary},
  formBlock: {padding: SPACING.md, flex: 1},
  desc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {opacity: 0.6},
  buttonText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '600'},
  searchRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md},
  searchBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  searchBtnText: {color: COLORS.textLight, fontWeight: '700'},
  resultList: {marginTop: SPACING.xs},
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {fontSize: 15, fontWeight: '800', color: COLORS.textLight},
  resultInfo: {flex: 1},
  resultName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  resultMeta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2},
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {color: COLORS.textLight, fontSize: FONT_SIZE.xs, fontWeight: '700'},
});
