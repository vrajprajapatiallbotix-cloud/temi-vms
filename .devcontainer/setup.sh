#!/bin/bash
set -e

echo "🔧 Setting up Temi VMS..."

# ── PostgreSQL setup ──────────────────────────────────────────────────────────
echo "📦 Starting PostgreSQL..."
sudo service postgresql start
sleep 2

echo "🗄️  Creating database and user..."
sudo -u postgres psql -c "CREATE USER vms_user WITH PASSWORD 'vms_secret';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE vms_db OWNER vms_user;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vms_db TO vms_user;" 2>/dev/null || true

echo "📋 Running migrations..."
sudo -u postgres psql -d vms_db -f backend/migrations/001_init.sql
sudo -u postgres psql -d vms_db -f backend/migrations/002_seed.sql

# ── Backend .env ──────────────────────────────────────────────────────────────
echo "⚙️  Creating backend .env..."
cat > backend/.env << 'EOF'
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
EOF

# ── Install dependencies ──────────────────────────────────────────────────────
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# ── Set admin password ────────────────────────────────────────────────────────
echo "🔐 Setting admin password..."
cd backend && node set-admin-password.js && cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "👉 Start the app by running:  bash .devcontainer/start.sh"
echo ""
