module.exports = () => ({
  getToken: jest.fn().mockResolvedValue('mock-token'),
  onMessage: jest.fn(() => jest.fn()),
  requestPermission: jest.fn().mockResolvedValue(1),
  AuthorizationStatus: { AUTHORIZED: 1 },
});
