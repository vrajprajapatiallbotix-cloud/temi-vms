#!/bin/bash

# Load NVM so node/npm are available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "🚀 Starting Temi VMS..."

# Ensure PostgreSQL is running
sudo service postgresql start 2>/dev/null
sleep 1

# Start backend in background
echo "▶  Starting backend on port 5000..."
cd /workspaces/temi-vms/backend
node src/server.js &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "▶  Starting frontend on port 5173..."
cd /workspaces/temi-vms/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Temi VMS is running!"
echo ""
echo "   📺 Frontend (Kiosk + Staff) → check PORTS tab in Codespaces for public URL"
echo "   🔌 Backend API              → port 5000 (also in PORTS tab)"
echo ""
echo "   🔑 Admin login: admin@vms.com / Admin@123"
echo "   🖥  Kiosk:      /kiosk"
echo "   👤 Staff:       /login"
echo ""
echo "Press Ctrl+C to stop."
wait $BACKEND_PID $FRONTEND_PID
