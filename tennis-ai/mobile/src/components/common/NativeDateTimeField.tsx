import React, {useState} from 'react';
import {Text, TouchableOpacity, StyleSheet} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function NativeDateField({label, value, onChange, minimumDate, maximumDate}: DateFieldProps) {
  const [show, setShow] = useState(false);

  const dateLabel = `${String(value.getDate()).padStart(2, '0')}.${String(value.getMonth() + 1).padStart(2, '0')}.${value.getFullYear()}`;

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={styles.fieldText}>📅 {dateLabel}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}

interface TimeFieldProps {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}

export function NativeTimeField({label, value, onChange}: TimeFieldProps) {
  const [show, setShow] = useState(false);

  const timeLabel = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={styles.fieldText}>🕐 {timeLabel}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value}
          mode="time"
          display="default"
          minuteInterval={30}
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.sm},
  field: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fieldText: {fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600'},
});
