import {Appearance} from 'react-native';

const LIGHT_COLORS = {
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  secondary: '#FF9800',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  error: '#D32F2F',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  disabled: '#BDBDBD',
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
  card: '#FFFFFF',
  cardAlt: '#F8FBF8',
  primaryGhost: '#E8F5E9',
  accent: '#FF6B35',
  textMuted: '#9E9E9E',
  overlay: 'rgba(0,0,0,0.5)',
  danger: '#EF4444',
};

const DARK_COLORS = {
  primary: '#4CAF50',
  primaryLight: '#66BB6A',
  primaryDark: '#2E7D32',
  secondary: '#FFA726',
  background: '#121212',
  surface: '#1E1E1E',
  error: '#EF5350',
  text: '#ECECEC',
  textSecondary: '#A0A0A0',
  textLight: '#FFFFFF',
  border: '#333333',
  disabled: '#5A5A5A',
  success: '#66BB6A',
  warning: '#FFA726',
  info: '#42A5F5',
  card: '#1E1E1E',
  cardAlt: '#232323',
  primaryGhost: '#1B3A1E',
  accent: '#FF8A65',
  textMuted: '#8A8A8A',
  overlay: 'rgba(0,0,0,0.7)',
  danger: '#EF5350',
};

// Палитра фиксируется при старте приложения по системной настройке
// (Android/iOS "тёмная тема"). Полностью безопасно для существующих
// экранов: все они используют эти же семантические ключи, поэтому
// смена палитры не требует правок в самих экранах.
export const IS_DARK_THEME = Appearance.getColorScheme() === 'dark';
export const COLORS = IS_DARK_THEME ? DARK_COLORS : LIGHT_COLORS;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};
