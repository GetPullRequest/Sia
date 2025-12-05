#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$MODELS_DIR/../.." && pwd)"
OPENAPI_SPEC="$PROJECT_ROOT/apps/api/openapi.json"

echo "Generating API client SDK from OpenAPI spec..."
echo "OpenAPI spec file: $OPENAPI_SPEC"
echo "Working directory: $MODELS_DIR"

# Check if OpenAPI spec file exists
if [ ! -f "$OPENAPI_SPEC" ]; then
  echo "❌ Error: OpenAPI spec file not found: $OPENAPI_SPEC"
  echo "   Please build the API first to generate openapi.json:"
  echo "   npx nx build @sia/api"
  exit 1
fi

# Change to models directory to use the config file
cd "$MODELS_DIR"

# Generate the client SDK using @hey-api/openapi-ts
# The config file (openapi-ts.config.ts) will be used automatically
npx --yes @hey-api/openapi-ts

echo "✅ API client SDK generation complete!"
echo "   Generated files in: src/generated/api-client"
