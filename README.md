# Temi VMS — Visitor Management System

A full-stack, production-ready Visitor Management System integrated with the **Temi Robot SDK** (temi V3, serial `00126040079`).

---

## Architecture Overview

```
temi-vms/
├── backend/          # Node.js + Express REST API + Socket.IO
├── frontend/         # React 18 + Tailwind CSS (Employee & Admin dashboards)
├── temi-app/         # Android (Kotlin) app for Temi V3 robot
└── docker-compose.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Socket.IO client, Zustand, Recharts |
| Backend | Node.js 20, Express 4, Socket.IO, JWT, bcryptjs, Nodemailer |
| Database | PostgreSQL 15 |
| QR | JWT-signed tokens + `qrcode` npm package |
| Temi App | Kotlin, Temi SDK 1.137.1, CameraX, ML Kit Barcode Scanning, Retrofit |
| Deployment | Docker + Docker Compose + Nginx |

---

## Visit Flows

### Pre-Planned Visit
```
Employee → Create Visit (web) → System sends invite email + secure link
→ Visitor fills form → QR generated + emailed
→ Visitor arrives → Temi greets → Visitor scans QR at Temi camera
→ Temi validates QR → Displays visitor info → Navigates to meeting room
→ Temi instructs visitor to wait
```

### Impromptu (Walk-In) Visit
```
Visitor arrives → Opens /visitor/impromptu kiosk → Fills name/purpose/whom to meet
→ System notifies employee (email + real-time Socket.IO)
→ Employee approves/declines → If approved: QR generated + emailed
→ Visitor scans QR at Temi → Temi escorts to employee desk
```

---

## Quick Start

### 1. Clone & Configure

```bash
git clone <repo>
cd temi-vms
cp backend/.env.example backend/.env
# Edit backend/.env with your DB credentials, JWT secrets, email config
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

- Backend: http://localhost:5000
- Frontend: http://localhost:80
- Database: localhost:5432

### 3. Run Locally (Development)

```bash
# Backend
cd backend
npm install
npm run dev       # http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev       # http://localhost:5173
```

### 4. Initialize Admin User

```bash
# Run after DB is up
cd backend
node -e "
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');
require('dotenv').config();
bcrypt.hash('Admin@123', 12).then(h => query(
  'UPDATE users SET password_hash = \$1 WHERE email = \$2',
  [h, 'admin@vms.com']
)).then(() => { console.log('Admin password set'); process.exit(); });
"
```

Default admin: `admin@vms.com` / `Admin@123`

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current user |

### Visitor
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/visitor/preplanned` | Employee | Create pre-planned visit |
| POST | `/api/visitor/impromptu` | Public | Walk-in registration |
| GET | `/api/visitor/register/:token` | Public | Get visitor form |
| POST | `/api/visitor/register/:token` | Public | Submit visitor form |

### Employee
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/employee/visits` | Employee | List own visits |
| GET | `/api/employee/visits/pending` | Employee | Pending approvals |
| POST | `/api/employee/approve` | Employee | Approve/decline visit |

### QR
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/qr/validate` | Temi API Key | Validate QR token |
| GET | `/api/qr/:visitId/image` | Employee | Get QR image |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/employees` | Admin | List employees |
| POST | `/api/admin/employees` | Admin | Create employee |
| GET | `/api/admin/analytics` | Admin | Analytics data |
| GET | `/api/admin/audit-logs` | Admin | Security audit logs |

### Temi Robot
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/temi/heartbeat` | Temi API Key | Robot status ping |
| GET | `/api/temi/config/:serial` | Temi API Key | Robot configuration |
| POST | `/api/temi/checkout` | Temi API Key | Mark visit complete |
| POST | `/api/temi/error` | Temi API Key | Report robot error |

---

## Temi Android App Setup

1. Open `temi-app/` in Android Studio
2. Edit `app/build.gradle`:
   ```groovy
   buildConfigField "String", "VMS_API_BASE_URL", '"http://YOUR_SERVER_IP:5000/api"'
   buildConfigField "String", "TEMI_API_KEY", '"your_temi_api_key"'
   ```
3. Build APK: `Build → Generate Signed APK`
4. Deploy via `adb install` or temi developer portal
5. Set as kiosk home app in temi Settings

### Temi Navigation Setup
Before deployment, save these location names in temi's map:
- `reception`
- `meeting_room_a`
- `meeting_room_b`
- `meeting_room_c`
- `conference_hall`
- `waiting_area`
- `home base`

---

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `QR_SECRET` | QR token signing secret (min 32 chars) |
| `TEMI_API_KEY` | Shared key between Temi app & backend |
| `EMAIL_HOST/USER/PASS` | SMTP credentials for notifications |
| `FRONTEND_URL` | Frontend base URL (for CORS & email links) |

---

## Security Features

- JWT authentication with role-based access (Admin / Employee)
- QR codes are JWT-signed with expiry (24h pre-planned, 2h impromptu)
- QR tokens are single-use (marked used on first scan)
- Temi API calls protected by `x-temi-api-key` header
- Rate limiting on all API endpoints
- Helmet.js security headers
- Photo uploads validated (type + size)
- Full audit log trail

---

## Real-Time Events (Socket.IO)

| Event | Direction | Payload |
|---|---|---|
| `visit:request` | Server → Employee | New impromptu visit |
| `visit:approved` | Server → Admin | Visit approved |
| `visit:checked_in` | Server → Employee + Admin | Visitor scanned in at Temi |
| `notification` | Server → User | General notification |

---

## Temi Robot Flow (Visual)

```
[Temi Idle - Welcome Screen]
        ↓ Person detected (OnDetectionStateChangedListener)
[Temi: "Please scan your QR code"]
        ↓ QRScanActivity launches (CameraX + ML Kit)
[Camera scans QR] → POST /api/qr/validate
        ↓
  ┌─────────────────┐
  │    QR Valid?     │
  └─────────────────┘
       │         │
     Yes         No
       │         ↓
       │   ErrorActivity
       │   TTS: error message
       ↓
VisitorDisplayActivity
TTS: "Welcome, [Name]! Please follow me"
       ↓
robot.goTo(meetingRoom)
       ↓ OnGoToLocationStatusChangedListener.COMPLETE
TTS: "We have arrived! Please take a seat."
       ↓
POST /api/temi/checkout  (after 30s)
       ↓
robot.goTo("home base")
```

---

## Database Schema

Key tables:
- `locations` — office locations (multi-site support)
- `users` — employees + admins (role-based)
- `visitors` — visitor profiles (reusable)
- `visits` — each visit event with status lifecycle
- `qr_codes` — JWT tokens with expiry + used flag
- `notifications` — real-time + persistent notifications
- `audit_logs` — full security audit trail
- `temi_robots` — robot registry + status

---

## Developed by
**Jarvis Technolabs** — *You Think, We Create*
Temi Serial: `00126040079` (temi V3, Android 11)
