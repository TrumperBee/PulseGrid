# PulseGrid - Quick Start Guide

## Prerequisites

- **Node.js** v18+ installed
- **PostgreSQL** installed and running
- **npm** package manager

---

## First Time Setup

### 1. Install Backend Dependencies
```bash
cd C:\Projects\PulseGrid\backend
npm install
```

### 2. Configure Database
Edit `backend/.env` and update these values:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pulsegrid
JWT_SECRET=your-secret-key-change-this
```

### 3. Create PostgreSQL Database
```bash
# Create the database
createdb pulsegrid

# Or if on Windows with pgAdmin, create a database named "pulsegrid"
```

### 4. Initialize Database & Test Account
```bash
cd C:\Projects\PulseGrid\backend
node setup.js
```

This will:
- Create all database tables
- Create a test user: `test@pulsegrid.io` / `password123`
- Add sample monitors

---

## Running PulseGrid

### Terminal 1 - Backend API
```bash
cd C:\Projects\PulseGrid\backend
node server.js
```
Backend runs on: **http://localhost:5000**

### Terminal 2 - Frontend
```bash
cd C:\Projects\PulseGrid
node server.js
```
Frontend runs on: **http://localhost:3000**

---

## Open in Browser

```
http://localhost:3000
```

---

## Test Login

```
Email:    test@pulsegrid.io
Password: password123
```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Register user | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/monitors` | List monitors | Yes |
| POST | `/api/monitors` | Create monitor | Yes |
| GET | `/api/monitors/:id` | Get monitor | Yes |
| PUT | `/api/monitors/:id` | Update monitor | Yes |
| DELETE | `/api/monitors/:id` | Delete monitor | Yes |
| POST | `/api/monitors/:id/test` | Test monitor | Yes |
| GET | `/api/stats/overview` | Dashboard stats | Yes |
| GET | `/api/incidents` | List incidents | Yes |
| GET | `/api/health` | Health check | No |

---

## Project Structure

```
PulseGrid/
├── index.html          # Frontend (React SPA)
├── server.js           # Frontend server (port 3000)
├── START.md            # This file
└── backend/
    ├── server.js       # Backend API (port 5000)
    ├── setup.js         # Database setup script
    ├── .env             # Environment variables
    ├── package.json
    ├── database/
    │   ├── db.js        # Database connection
    │   └── schema.sql   # Database schema
    ├── routes/
    │   ├── auth.js
    │   ├── monitors.js
    │   ├── stats.js
    │   └── incidents.js
    ├── services/
    │   ├── checker.js   # API checking engine
    │   ├── scheduler.js # Check scheduler
    │   └── alertService.js
    └── middleware/
        ├── auth.js
        └── errorHandler.js
```

---

## Troubleshooting

### "Cannot connect to database"
- Make sure PostgreSQL is running
- Check `DATABASE_URL` in `.env` has correct credentials

### "Module not found"
- Run `npm install` in the backend folder

### Frontend shows blank screen
- Make sure both backend AND frontend servers are running
- Check browser console for errors

### Port already in use
```bash
# Find and kill process on port
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

---

## Environment Variables (.env)

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pulsegrid
JWT_SECRET=your-super-secret-jwt-key
USE_MOCK_DB=false
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
```

---

## Features

- [x] User authentication (signup/login)
- [x] API monitoring (HTTP checks)
- [x] Response time tracking
- [x] Uptime percentage
- [x] Incident tracking
- [x] Email/Slack/Discord alerts
- [x] Status pages
- [x] Reports
- [x] Team management
- [x] Dark theme UI
