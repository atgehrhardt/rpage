#!/bin/bash
# Script to completely rebuild the Docker container with a fresh database

echo "Stopping any running containers..."
docker-compose down

echo "Removing Docker volume to ensure fresh database..."
# Remove the full volume name based on project name 
docker volume rm rpage_rpage_data || true

echo "Building the Docker image..."
docker-compose build --no-cache

echo "Starting the application..."
docker-compose up -d

echo "Done! Application should be available at http://localhost:3000"
echo "To check logs: docker-compose logs -f"