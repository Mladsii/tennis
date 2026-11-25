module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-runner|@react-native|react-native|@react-navigation|react-native-vector-icons|react-native-svg|react-native-screens|react-native-safe-area-context|@react-native-async-storage|react-native-sound|react-native-webview|react-native-vision-camera|react-native-qrcode-svg)/)',
  ],
  moduleNameMapper: {
    '@react-native-async-storage/async-storage':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    'react-native-sound': '<rootDir>/__mocks__/react-native-sound.js',
    'react-native-vector-icons/(.*)': '<rootDir>/__mocks__/react-native-vector-icons.js',
    'react-native-vision-camera': '<rootDir>/__mocks__/react-native-vision-camera.js',
    '@react-native-firebase/app': '<rootDir>/__mocks__/@react-native-firebase/app.js',
    '@react-native-firebase/messaging': '<rootDir>/__mocks__/@react-native-firebase/messaging.js',
  },
};
