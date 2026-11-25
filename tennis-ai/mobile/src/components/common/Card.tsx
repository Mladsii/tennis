import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS } from '../../constants/theme';

type CardVariant = 'default' | 'elevated' | 'ghost';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: CardVariant;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
}) => {
  const cardStyle = [
    styles.base,
    variant === 'elevated' && styles.elevated,
    variant === 'ghost' && styles.ghost,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    ...SHADOWS.sm,
  },
  elevated: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    ...SHADOWS.lg,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
