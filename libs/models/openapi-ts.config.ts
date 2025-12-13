import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../apps/api/openapi.json',
  output: './src/generated/api-client',
  plugins: ['@hey-api/typescript', '@hey-api/sdk'],
});
