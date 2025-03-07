#!/bin/sh
set -e

# Make sure we have a fresh database directory
echo "Setting up database directory..."
mkdir -p /app/data/outputs
ls -la /app/data

# Start the server in the background
echo "Starting the backend server..."
node --no-warnings server.cjs &
SERVER_PID=$!

# Start the vite dev server
echo "Starting the frontend dev server..."
exec npx vite --host 0.0.0.0

# If the vite server exits, kill the backend server
kill $SERVER_PID