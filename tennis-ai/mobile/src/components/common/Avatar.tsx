import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RADIUS } from '../../constants/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  color?: string;
}

const AVATAR_COLORS = [
  '#2E7D32',
  '#1565C0',
  '#6A1B9A',
  '#AD1457',
  '#E65100',
  '#00695C',
  '#4527A0',
  '#283593',
  '#558B2F',
  '#827717',
];

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 20,
  xl: 26,
};

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const word = parts[0] || '';
  return word.slice(0, 2).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  color,
}) => {
  const dimension = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const backgroundColor = color ?? getColorFromName(name);
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: RADIUS.full,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
