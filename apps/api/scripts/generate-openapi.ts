import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Fastify from 'fastify';
import { setupFastify } from '../src/utils/setup-fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(API_DIR, 'openapi.json');

async function generateOpenApiSpec() {
  const fastify = Fastify({
    logger: false,
  });

  // Setup Fastify with all plugins, schemas, and routes
  // Disable Swagger UI and CORS for OpenAPI generation
  await setupFastify(fastify, {
    logger: false,
    enableSwaggerUi: false,
    enableCors: false,
    enableWebSocket: false,
  });

  // Wait for Fastify to be ready
  await fastify.ready();

  // Generate the OpenAPI spec
  const spec = fastify.swagger();

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(spec, null, 2), 'utf-8');

  console.log(`✅ OpenAPI spec generated: ${OUTPUT_FILE}`);

  await fastify.close();
}

generateOpenApiSpec().catch(error => {
  console.error('❌ Error generating OpenAPI spec:', error);
  process.exit(1);
});
