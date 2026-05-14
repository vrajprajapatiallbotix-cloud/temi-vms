#!/bin/bash
# Start Temi VMS — run this in the Codespaces terminal

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Starting Temi VMS..."

# Start backend
echo "▶  Backend  → port 5000"
cd "$ROOT/backend"
node src/server.js &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "▶  Frontend → port 5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers running!"
echo "   Go to PORTS tab → click 🌐 on port 5173 for your public URL"
echo ""
echo "   Admin:  admin@vms.com / Admin@123"
echo "   Kiosk:  <your-url>/kiosk"
echo "   Staff:  <your-url>/login"
echo ""
echo "Press Ctrl+C to stop both servers."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait $BACKEND_PID $FRONTEND_PID
