#!/bin/bash
# Initialise PostgreSQL database for Temi VMS (runs once after container build)
set -e

echo "🗄️  Waiting for PostgreSQL to be ready..."
for i in $(seq 1 15); do
  pg_isready -U postgres && break
  sleep 2
done

echo "🗄️  Creating DB user and database..."
psql -U postgres -c "CREATE USER vms_user WITH PASSWORD 'vms_secret';" 2>/dev/null || true
psql -U postgres -c "CREATE DATABASE vms_db OWNER vms_user;" 2>/dev/null || true
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE vms_db TO vms_user;" 2>/dev/null || true

echo "📋 Running migrations..."
psql -U postgres -d vms_db -f backend/migrations/001_init.sql
psql -U postgres -d vms_db -f backend/migrations/002_seed.sql

echo "⚙️  Creating backend .env..."
cat > backend/.env << 'ENVEOF'
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://vms_user:vms_secret@localhost:5432/vms_db
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

echo "🔐 Setting admin password..."
node backend/set-admin-password.js

echo "✅ Database setup complete!"
