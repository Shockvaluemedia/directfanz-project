module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/.kiro/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 65,
      functions: 70,
      lines: 70
    },
    // Critical paths require higher coverage
    'src/app/api/**/*.ts': {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    },
    'src/lib/auth*.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    'src/lib/payment*.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    },
    'src/lib/security*.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  verbose: true
};