// Jest config for the Firestore security-rules tests (rules-tests/). These need the
// Firestore emulator, so they run via `firebase emulators:exec` in CI, not `npm test`.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules-tests/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  testTimeout: 30000,
};
