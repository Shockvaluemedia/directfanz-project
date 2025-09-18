const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock problematic ES modules
    '^jose$': '<rootDir>/src/__mocks__/jose.js',
    '^next-auth$': '<rootDir>/src/__mocks__/next-auth.js',
    '^next-auth/(.*)$': '<rootDir>/src/__mocks__/next-auth.js',
  },
  testEnvironment: 'jest-environment-jsdom',
  // Add file extension resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Resolve modules in order of preference
  resolver: undefined, // Let Next.js handle this
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
    '!src/app/globals.css',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
  ],
  // Handle ES modules that Jest can't parse by default
  transformIgnorePatterns: [
    'node_modules/(?!(jose|openid-client|next-auth|@next-auth|oauth4webapi)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)