import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {competitionsApi} from '../../api/competitions';
import {GroupCreate} from '../../types/competition';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {extractErrorMessage} from '../../utils/format';
import {handlePremiumError} from '../../utils/premiumError';

export default function CreateCompetitionScreen({navigation}: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [groups, setGroups] = useState<GroupCreate[]>([]);

  const [grpName, setGrpName] = useState('');
  const [grpAgeFrom, setGrpAgeFrom] = useState('');
  const [grpAgeTo, setGrpAgeTo] = useState('');
  const [grpStmFrom, setGrpStmFrom] = useState('');
  const [grpStmTo, setGrpStmTo] = useState('');
  const [grpMax, setGrpMax] = useState('');

  const [loading, setLoading] = useState(false);

  const addGroup = () => {
    if (!grpName.trim()) {
      Alert.alert('Ошибка', 'Введите название группы');
      return;
    }
    setGroups(prev => [
      ...prev,
      {
        name: grpName.trim(),
        age_from: grpAgeFrom ? parseInt(grpAgeFrom, 10) : null,
        age_to: grpAgeTo ? parseInt(grpAgeTo, 10) : null,
        stm_from: grpStmFrom ? parseFloat(grpStmFrom) : null,
        stm_to: grpStmTo ? parseFloat(grpStmTo) : null,
        max_participants: grpMax ? parseInt(grpMax, 10) : null,
      },
    ]);
    setGrpName('');
    setGrpAgeFrom('');
    setGrpAgeTo('');
    setGrpStmFrom('');
    setGrpStmTo('');
    setGrpMax('');
  };

  const removeGroup = (idx: number) => {
    setGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Ошибка', 'Введите название');
    if (!startDate || !endDate) return Alert.alert('Ошибка', 'Введите даты (ГГГГ-ММ-ДД)');
    setLoading(true);
    try {
      await competitionsApi.create({
        name: name.trim(),
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        location: location || null,
        groups,
      });
      Alert.alert('Готово', 'Соревнование создано');
      navigation.goBack();
    } catch (e: any) {
      if (!handlePremiumError(e, navigation)) {
        Alert.alert('Ошибка', extractErrorMessage(e, 'Не удалось создать'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        placeholder="Весенний турнир 2026"
        placeholderTextColor={COLORS.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Открытый турнир..."
        placeholderTextColor={COLORS.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={styles.row}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Начало (ГГГГ-ММ-ДД)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-05-15"
            placeholderTextColor={COLORS.textSecondary}
            value={startDate}
            onChangeText={setStartDate}
          />
        </View>
        <View style={{width: SPACING.sm}} />
        <View style={{flex: 1}}>
          <Text style={styles.label}>Конец</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-05-17"
            placeholderTextColor={COLORS.textSecondary}
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>
      </View>

      <Text style={styles.label}>Место проведения</Text>
      <TextInput
        style={styles.input}
        placeholder="КСК Спартак, Москва"
        placeholderTextColor={COLORS.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.section}>Группы участников</Text>

      {groups.map((g, idx) => (
        <View key={idx} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName}>{g.name}</Text>
            <TouchableOpacity onPress={() => removeGroup(idx)}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.groupMeta}>
            {g.age_from || g.age_to
              ? `Возраст: ${g.age_from ?? '?'}–${g.age_to ?? '?'}  `
              : ''}
            {g.stm_from || g.stm_to ? `СТМ: ${g.stm_from ?? '?'}–${g.stm_to ?? '?'}  ` : ''}
            {g.max_participants ? `Макс: ${g.max_participants}` : ''}
          </Text>
        </View>
      ))}

      <View style={styles.addGroupBox}>
        <Text style={styles.addGroupTitle}>Добавить группу</Text>
        <TextInput
          style={styles.input}
          placeholder="СТМ 3.0–4.5, 18–35 лет"
          placeholderTextColor={COLORS.textSecondary}
          value={grpName}
          onChangeText={setGrpName}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, {flex: 1}]}
            placeholder="Возраст от"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={grpAgeFrom}
            onChangeText={setGrpAgeFrom}
          />
          <View style={{width: SPACING.sm}} />
          <TextInput
            style={[styles.input, {flex: 1}]}
            placeholder="до"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={grpAgeTo}
            onChangeText={setGrpAgeTo}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, {flex: 1}]}
            placeholder="СТМ от"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
            value={grpStmFrom}
            onChangeText={setGrpStmFrom}
          />
          <View style={{width: SPACING.sm}} />
          <TextInput
            style={[styles.input, {flex: 1}]}
            placeholder="до"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
            value={grpStmTo}
            onChangeText={setGrpStmTo}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Макс. участников"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
          value={grpMax}
          onChangeText={setGrpMax}
        />
        <TouchableOpacity style={styles.addGroupBtn} onPress={addGroup}>
          <Text style={styles.addGroupBtnText}>+ Добавить группу</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submit, loading && styles.disabled]}
        disabled={loading}
        onPress={submit}>
        {loading ? (
          <ActivityIndicator color={COLORS.textLight} />
        ) : (
          <Text style={styles.submitText}>Создать соревнование</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md, paddingBottom: SPACING.xl},
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  textArea: {height: 80, textAlignVertical: 'top'},
  row: {flexDirection: 'row', alignItems: 'flex-end'},
  section: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  groupHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  groupName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1},
  groupMeta: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  remove: {fontSize: 20, color: COLORS.error, paddingLeft: SPACING.sm},
  addGroupBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addGroupTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  addGroupBtn: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  addGroupBtnText: {color: COLORS.primary, fontWeight: '600'},
  submit: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: {opacity: 0.6},
  submitText: {color: COLORS.textLight, fontSize: FONT_SIZE.md, fontWeight: '700'},
});
