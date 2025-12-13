#!/bin/bash

# Build script for sia-dev-env container

echo "Building sia-dev-env container..."

docker build -f Dockerfile.dev-env -t sia-dev-env:latest .

if [ $? -eq 0 ]; then
    echo "✓ Successfully built sia-dev-env:latest"
    echo ""
    echo "You can now run the SIA agent with:"
    echo "  npm run start -- --api-key YOUR_API_KEY"
else
    echo "✗ Failed to build sia-dev-env container"
    exit 1
fi
