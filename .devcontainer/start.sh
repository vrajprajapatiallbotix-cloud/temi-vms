#!/bin/bash
ROOT="/workspaces/temi-vms/temi-vms"

echo "🚀 Starting Temi VMS..."

# Backend
nohup node "$ROOT/backend/src/server.js" > /tmp/temi-backend.log 2>&1 &
echo "✅ Backend started (log: /tmp/temi-backend.log)"

# Frontend — vite.config.js already has host:true so it binds 0.0.0.0
cd "$ROOT/frontend" && nohup npm run dev > /tmp/temi-frontend.log 2>&1 &
echo "✅ Frontend started (log: /tmp/temi-frontend.log)"

echo ""
echo "🌐 Frontend: https://${CODESPACE_NAME}-5173.app.github.dev"
echo "   Admin:  admin@vms.com / Admin@123"
echo "   Kiosk:  <url>/kiosk   |   Staff: <url>/login"
