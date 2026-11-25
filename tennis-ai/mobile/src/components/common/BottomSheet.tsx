import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';

export interface SheetAction {
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
  children?: React.ReactNode;
}

export default function BottomSheet({visible, title, subtitle, actions, onClose, children}: Props) {
  const slide = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(300);
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    }
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, {transform: [{translateY: slide}]}]}>
              <View style={styles.handle} />
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              {children}
              <View style={styles.actions}>
                {actions.map((a, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.actionBtn,
                      a.primary && styles.actionPrimary,
                      a.destructive && styles.actionDestructive,
                    ]}
                    onPress={() => {
                      onClose();
                      // дать модалке закрыться до перехода
                      setTimeout(a.onPress, 120);
                    }}>
                    <Text
                      style={[
                        styles.actionText,
                        a.primary && styles.actionTextPrimary,
                        a.destructive && styles.actionTextDestructive,
                      ]}>
                      {a.icon ? `${a.icon}  ` : ''}{a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeText}>Закрыть</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  title: {fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text},
  subtitle: {fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4},
  actions: {marginTop: SPACING.md, gap: SPACING.sm},
  actionBtn: {
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  actionPrimary: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  actionDestructive: {borderColor: COLORS.error},
  actionText: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  actionTextPrimary: {color: COLORS.textLight},
  actionTextDestructive: {color: COLORS.error},
  closeBtn: {paddingVertical: SPACING.sm, alignItems: 'center'},
  closeText: {fontSize: FONT_SIZE.md, color: COLORS.textSecondary},
});
