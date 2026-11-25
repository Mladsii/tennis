import React, {useRef} from 'react';
import {Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View, ViewStyle} from 'react-native';
import {COLORS, FONT_SIZE} from '../../constants/theme';

const ACTION_WIDTH = 88;
const SWIPE_THRESHOLD = ACTION_WIDTH * 0.6;

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  actionLabel?: string;
  style?: ViewStyle;
}

/** Свайп влево открывает кнопку отмены — без нативных зависимостей (react-native-gesture-handler не установлен). */
export default function SwipeToCancel({children, onDelete, actionLabel = 'Отменить', style}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-ACTION_WIDTH, currentOffset.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = currentOffset.current + g.dx;
        const openIt = next < -SWIPE_THRESHOLD;
        currentOffset.current = openIt ? -ACTION_WIDTH : 0;
        Animated.spring(translateX, {
          toValue: currentOffset.current,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  const close = () => {
    currentOffset.current = 0;
    Animated.spring(translateX, {toValue: 0, useNativeDriver: true, bounciness: 4}).start();
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.actionBg}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            close();
            onDelete();
          }}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[styles.foreground, {transform: [{translateX}]}]}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {position: 'relative'},
  actionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  actionBtn: {flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center'},
  actionText: {color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm},
  foreground: {backgroundColor: 'transparent'},
});
