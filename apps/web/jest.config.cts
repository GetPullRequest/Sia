const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  dir: __dirname,
});

const config = {
  displayName: '@sia/web',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
  testEnvironment: 'jsdom',
};

module.exports = createJestConfig(config);
