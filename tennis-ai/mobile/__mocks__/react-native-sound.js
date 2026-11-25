const Sound = jest.fn().mockImplementation((file, bundle, cb) => {
  if (cb) cb(null);
  return {
    play: jest.fn(),
    stop: jest.fn(),
    release: jest.fn(),
    setVolume: jest.fn(),
  };
});
Sound.setCategory = jest.fn();
Sound.MAIN_BUNDLE = '';
module.exports = Sound;
