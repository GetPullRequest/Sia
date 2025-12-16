import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(MODELS_DIR, '..', '..');
const PROTO_DIR = path.join(PROJECT_ROOT, 'apps', 'agent', 'proto');
const OUTPUT_DIR = path.join(MODELS_DIR, 'src', 'generated');

function resolveBin(binName) {
  const base = path.join(PROJECT_ROOT, 'node_modules', '.bin', binName);
  const candidates =
    process.platform === 'win32'
      ? [`${base}.cmd`, `${base}.EXE`, base]
      : [base];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return base;
}

function runProtoc() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const pluginPath = resolveBin('protoc-gen-ts_proto');
  const protocArgs = [
    `--plugin=protoc-gen-ts_proto=${pluginPath}`,
    `--ts_proto_out=${OUTPUT_DIR}`,
    '--ts_proto_opt=esModuleInterop=true',
    '--ts_proto_opt=outputServices=grpc-js',
    '--ts_proto_opt=env=node',
    '--ts_proto_opt=useOptionals=messages',
    `--proto_path=${PROTO_DIR}`,
    `${PROTO_DIR}/*.proto`,
  ];

  console.log('Generating TypeScript code from proto files...');
  console.log(`Proto directory: ${PROTO_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  execFileSync('npx', ['protoc', ...protocArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function updateIndex() {
  const files = fs
    .readdirSync(PROTO_DIR)
    .filter(file => file.endsWith('.proto'));
  const lines = [
    '// Auto-generated index file - exports all generated proto types and API client',
    '// This file is regenerated when proto files or API changes',
    '',
  ];

  for (const file of files) {
    const name = file.replace(/\.proto$/, '');
    lines.push(`export * from './${name}.js';`);
  }

  const apiClientDir = path.join(OUTPUT_DIR, 'api-client');
  if (fs.existsSync(apiClientDir)) {
    lines.push("export * from './api-client/index.js';");
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), lines.join('\n'));
}

try {
  runProtoc();
  updateIndex();
  console.log('Proto code generation complete!');
} catch (err) {
  console.error('❌ Proto generation failed.');
  console.error(err.message || err);
  process.exit(1);
}
