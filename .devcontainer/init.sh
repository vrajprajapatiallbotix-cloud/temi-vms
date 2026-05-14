#!/bin/bash
set -e

echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -U vms_user -d vms_db 2>/dev/null; do
  sleep 2
done
echo "✅ PostgreSQL is ready"

echo "📋 Running migrations..."
psql postgresql://vms_user:vms_secret@postgres:5432/vms_db -f backend/migrations/001_init.sql
psql postgresql://vms_user:vms_secret@postgres:5432/vms_db -f backend/migrations/002_seed.sql

echo "⚙️  Creating backend .env..."
cat > backend/.env << 'ENVEOF'
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://vms_user:vms_secret@postgres:5432/vms_db
JWT_SECRET=codespaces_jwt_secret_temi_vms_2024
JWT_EXPIRES_IN=7d
QR_SECRET=codespaces_qr_secret_temi_vms_2024
FRONTEND_URL=http://localhost:5173
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="VMS System <noreply@vms.com>"
QR_PREPLANNED_EXPIRY_HOURS=24
QR_IMPROMPTU_EXPIRY_HOURS=2
TEMI_SERIAL=00126040079
TEMI_API_KEY=temi_internal_api_key
ENVEOF

echo "📦 Installing dependencies..."
npm --prefix backend install
npm --prefix frontend install

echo "🔐 Setting admin password..."
node backend/set-admin-password.js

echo ""
echo "✅ Setup complete! Run:  bash .devcontainer/start.sh"
