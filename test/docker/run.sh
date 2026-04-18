#!/bin/bash
# Build and run the antidrift Docker integration test
# Run from the repo root: ./test/docker/run.sh

set -e
cd "$(dirname "$0")/../.."

echo "Building test image..."
docker build -f test/docker/Dockerfile -t antidrift-test . 2>&1

echo ""
echo "Running tests..."
docker run --rm antidrift-test
