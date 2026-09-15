module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  clearMocks: true,
  transform: { '^.+\\.[jt]s$': ['ts-jest', { tsconfig: { allowJs: true } }] },
  transformIgnorePatterns: ['node_modules/(?!@nestjs/(bullmq|bull-shared)/)'],
};
