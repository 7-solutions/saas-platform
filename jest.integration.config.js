module.exports = {
  displayName: 'Integration Tests',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.js'],
  testTimeout: 120000, // 2 minutes for integration tests
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1, // Run tests sequentially for integration tests
  forceExit: true,
  detectOpenHandles: true,
};