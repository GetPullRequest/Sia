#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$MODELS_DIR/../.." && pwd)"
PROTO_DIR="$PROJECT_ROOT/apps/agent/proto"
OUTPUT_DIR="$MODELS_DIR/src/generated"

mkdir -p "$OUTPUT_DIR"

echo "Generating TypeScript code from proto files..."
echo "Proto directory: $PROTO_DIR"
echo "Output directory: $OUTPUT_DIR"

npx protoc \
  --plugin=protoc-gen-ts_proto="$PROJECT_ROOT/node_modules/.bin/protoc-gen-ts_proto" \
  --ts_proto_out="$OUTPUT_DIR" \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=env=node \
  --ts_proto_opt=useOptionals=messages \
  --proto_path="$PROTO_DIR" \
  "$PROTO_DIR"/*.proto

echo "Updating generated index file..."
cat > "$OUTPUT_DIR/index.ts" << 'EOF'
// Auto-generated index file - exports all generated proto types and API client
// This file is regenerated when proto files or API changes

EOF

for proto_file in "$PROTO_DIR"/*.proto; do
  if [ -f "$proto_file" ]; then
    proto_name=$(basename "$proto_file" .proto)
    echo "export * from './${proto_name}.js';" >> "$OUTPUT_DIR/index.ts"
  fi
done

# Add API client export if it exists
if [ -d "$OUTPUT_DIR/api-client" ]; then
  echo "export * from './api-client/index.js';" >> "$OUTPUT_DIR/index.ts"
fi

echo "Proto code generation complete!"

