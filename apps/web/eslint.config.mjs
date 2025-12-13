import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import { fixupConfigRules } from '@eslint/compat';
import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import baseConfig from '../../eslint.config.mjs';
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

const nextConfigs = fixupConfigRules(compat.extends('next'));
const nextCoreWebVitalsConfigs = fixupConfigRules(
  compat.extends('next/core-web-vitals')
);

export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  ...nextConfigs,
  ...nextCoreWebVitalsConfigs,
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  {
    ignores: [
      '.next/**/*',
      '**/out-tsc',
      '**/generated/**/*',
      '**/*.gen.ts',
    ],
  },
];
