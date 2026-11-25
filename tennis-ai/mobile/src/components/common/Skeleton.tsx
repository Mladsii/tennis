import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, ViewStyle} from 'react-native';
import {SPACING} from '../../constants/theme';

export function SkeletonBlock({style}: {style?: ViewStyle}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {toValue: 1, duration: 650, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.4, duration: 650, useNativeDriver: true}),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, {opacity}]} />;
}

/** Скелетон списка карточек — на время первой загрузки экрана */
export function SkeletonList({count = 3}: {count?: number}) {
  return (
    <View style={styles.list}>
      {Array.from({length: count}).map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBlock style={{width: '55%', height: 16}} />
          <SkeletonBlock style={{width: '80%', height: 12, marginTop: 8}} />
          <SkeletonBlock style={{width: '35%', height: 12, marginTop: 6}} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
  },
  list: {padding: SPACING.md, gap: SPACING.sm},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
  },
});
