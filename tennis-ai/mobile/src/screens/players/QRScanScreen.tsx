import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';
import {preferredPlayersApi} from '../../api/feed';
import {extractErrorMessage} from '../../utils/format';
import {handlePremiumError} from '../../utils/premiumError';

export default function QRScanScreen({navigation}: any) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async codes => {
      if (scanned || processing) return;
      const value = codes[0]?.value;
      if (!value) return;

      // Формат: tennisai://user/{userId}
      const match = value.match(/^tennisai:\/\/user\/([a-f0-9-]{36})$/);
      if (!match) {
        Alert.alert('Ошибка', 'Неверный QR-код. Попробуйте ещё раз.');
        return;
      }

      setScanned(true);
      setProcessing(true);
      const targetUserId = match[1];

      try {
        // Добавляем по userId
        await preferredPlayersApi.addById(targetUserId);
        Alert.alert(
          '✅ Игрок добавлен',
          'Игрок добавлен в список ваших соперников',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
      } catch (e: any) {
        if (!handlePremiumError(e, navigation)) {
          const msg = extractErrorMessage(e, 'Не удалось добавить игрока');
          Alert.alert('Ошибка', msg, [
            {text: 'Повторить', onPress: () => setScanned(false)},
            {text: 'Отмена', onPress: () => navigation.goBack()},
          ]);
        }
      } finally {
        setProcessing(false);
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Нужен доступ к камере</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Разрешить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.permText}>Инициализация камеры...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned}
        codeScanner={codeScanner}
      />

      {/* Рамка сканирования */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          {processing ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <>
              <Text style={styles.scanHint}>
                Наведи камеру на QR-код игрока
              </Text>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => navigation.goBack()}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const SCAN_SIZE = 240;
const CORNER = 24;
const BORDER = 4;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  permText: {fontSize: FONT_SIZE.md, color: COLORS.text},
  permBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  permBtnText: {color: COLORS.textLight, fontWeight: '700'},
  overlay: {flex: 1},
  topOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)'},
  middleRow: {flexDirection: 'row', height: SCAN_SIZE},
  sideOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)'},
  scanArea: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: COLORS.primary,
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: BORDER, borderLeftWidth: BORDER,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: BORDER, borderRightWidth: BORDER,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: BORDER, borderLeftWidth: BORDER,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: BORDER, borderRightWidth: BORDER,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  scanHint: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    textAlign: 'center',
  },
  cancelBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cancelText: {color: '#fff', fontSize: FONT_SIZE.sm},
});
