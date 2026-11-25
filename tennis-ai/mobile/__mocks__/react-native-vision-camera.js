module.exports = {
  Camera: 'Camera',
  useCameraDevices: () => ({}),
  useCameraDevice: () => null,
  useCameraPermission: () => ({hasPermission: false, requestPermission: jest.fn()}),
};
