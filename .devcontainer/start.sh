#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Starting Temi VMS..."

cd "$ROOT/backend"
node src/server.js &
BACKEND_PID=$!
sleep 2

cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Temi VMS is running!"
echo "   → Go to PORTS tab, right-click port 5173 → Open in Browser"
echo "   → Admin: admin@vms.com / Admin@123"
echo "   → Kiosk: <url>/kiosk   Staff: <url>/login"
echo ""
echo "Press Ctrl+C to stop."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait $BACKEND_PID $FRONTEND_PID
