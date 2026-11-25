import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../../constants/theme';

interface BadgeProps {
  count: number;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ count, children }) => {
  return (
    <View style={styles.wrapper}>
      {children}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.text} numberOfLines={1}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
