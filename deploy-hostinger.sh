#!/bin/bash
# Health Companion API - Hostinger Docker Deploy Script
# Run this on your Hostinger VPS after uploading files

set -e

echo "🐳 Building Health Companion API Docker image..."

# Build the Docker image
docker build -t health-companion-api .

# Run with docker-compose (if available)
if command -v docker-compose &> /dev/null; then
    echo "🚀 Starting with docker-compose..."
    docker-compose up -d
else
    echo "🚀 Starting with docker run..."
    docker run -d \
        --name health-companion-api \
        -p 38257:38257 \
        --env-file .env \
        --restart unless-stopped \
        health-companion-api
fi

echo "✅ Health Companion API deployed!"
echo "🔗 API running at: http://YOUR_SERVER_IP:38257"
echo "📋 Health check: http://YOUR_SERVER_IP:38257/api/health"