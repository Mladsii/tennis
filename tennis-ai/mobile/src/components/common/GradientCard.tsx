import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SHADOWS, RADIUS } from '../../constants/theme';

interface GradientCardProps {
  colors: string[];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// react-native-linear-gradient is not installed in this project.
// Fallback: solid background using the first color in the array.
export const GradientCard: React.FC<GradientCardProps> = ({
  colors,
  children,
  style,
}) => {
  const backgroundColor = colors[0] ?? '#2E7D32';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    padding: 16,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
});
