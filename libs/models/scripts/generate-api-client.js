import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(MODELS_DIR, '..', '..');
const OPENAPI_SPEC = path.join(PROJECT_ROOT, 'apps', 'api', 'openapi.json');

try {
  if (!fs.existsSync(OPENAPI_SPEC)) {
    console.error(`❌ Error: OpenAPI spec not found at ${OPENAPI_SPEC}`);
    console.error('Build the API first: npx nx build @sia/api');
    process.exit(1);
  }

  console.log('Generating API client SDK from OpenAPI spec...');
  console.log(`OpenAPI spec file: ${OPENAPI_SPEC}`);
  console.log(`Working directory: ${MODELS_DIR}`);

  execFileSync('npx', ['@hey-api/openapi-ts'], {
    cwd: MODELS_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  console.log('✅ API client SDK generation complete!');
  console.log('   Generated files in: src/generated/api-client');
} catch (err) {
  console.error('❌ API client generation failed.');
  console.error(err.message || err);
  process.exit(1);
}
