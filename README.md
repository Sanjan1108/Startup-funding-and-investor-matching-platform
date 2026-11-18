# VentureLink — Startup Funding & Investor Matching Platform

VentureLink is a dual-paradigm full-stack web application designed for startup funding, weighted investor matching, and term sheet deal negotiations. 

The application is architected into two clean, decoupled tiers:
- **`frontend/`**: Next.js 14+ App Router, React, and TypeScript web client.
- **`backend/`**: Node.js & Express REST API server with **MySQL** (relational) and **MongoDB** (NoSQL).

---

## Architecture Overview

```
startup_funding_full_project/
├── backend/                  # Express REST API Server (Port 5000)
│   ├── src/
│   │   ├── lib/              # Database pool (MySQL & MongoDB), JWT auth, audit logging
│   │   ├── middleware/       # requireAuth authentication middleware
│   │   ├── routes/           # REST endpoints (auth, dashboard, match, negotiations, etc.)
│   │   └── server.ts         # Express server entry point
│   ├── database/             # SQL schemas (database.sql, triggers.sql, backups)
│   ├── tests/                # Manual test plan & checklist
│   ├── package.json
│   └── .env.example
│
├── frontend/                 # Next.js 14+ Web Application (Port 3000)
│   ├── app/                  # App Router pages (Founder & Investor Dashboards, Directories)
│   ├── components/           # AppShell, DataPage generic CRUD interfaces
│   ├── lib/auth.ts           # Token verification helper
│   ├── next.config.mjs       # Automatic API reverse-proxy / rewrites to backend
│   ├── package.json
│   └── .env.example
│
├── package.json              # Root orchestration scripts
└── README.md
```

---

## Features

- **Role-Tailored Dashboards**:
  - **Founder Dashboard**: Capital raised vs target, funding round progress bars, deal negotiations, investor match cards.
  - **Investor Portfolio Dashboard**: Capital deployed, portfolio distribution, active term sheet deal flow, investment criteria summary.
  - **Interactive Perspective Switcher**: Switch views instantly between Founder, Investor, and Platform Overview.
- **Weighted Matching Engine**:
  - Baseline score + industry fit + stage fit + ticket-size fit.
  - Automatically calculates and persists ranked compatibility scores in MySQL.
- **Interactive Term Sheet Negotiations**:
  - Multi-round counter-offers between startups and investors with equity % and implied valuation calculations.
  - Deal acceptance executes **MySQL ACID Transactions** creating investment records.
  - MongoDB stores unstructured message threads, events, and timestamped timelines.
- **Pitch Deck Intelligence**:
  - Reference records stored in MySQL; pitch text and extracted keywords stored in MongoDB with full-text/keyword search.
- **Authentication & Security**:
  - Bcrypt password hashing.
  - Signed JSON Web Tokens (JWT) stored in HTTP-only cookies (`sf_session`).

---

## Prerequisites

- **Node.js**: v18.17+ (v20+ recommended)
- **MySQL**: 8.0+
- **MongoDB**: Community Server (v6+) or MongoDB Atlas

---

## Quick Start (Running Both Tiers)

### 1. Database Setup
1. Start MySQL and run the database schema and triggers:
   ```bash
   mysql -u root -p < backend/database/database.sql
   mysql -u root -p < backend/database/triggers.sql
   ```
2. Start MongoDB locally (port 27017) or prepare your Atlas connection string.

### 2. Configure Environment Variables
- **Backend**:
  Copy `backend/.env.example` to `backend/.env` and enter your MySQL password, MongoDB URI, and a secure `JWT_SECRET`.
- **Frontend**:
  Copy `frontend/.env.example` to `frontend/.env.local`.

### 3. Install All Dependencies
From the root folder, run:
```bash
npm run install:all
```
*(Or run `npm install` inside both `backend` and `frontend` folders)*

### 4. Start Both Servers Concurrently
From the root folder, run:
```bash
npm run dev
```
- **Backend API**: Running on `http://localhost:5000`
- **Frontend App**: Running on `http://localhost:3000`

---

## Running Tiers Separately

### Running the Backend Alone
```bash
cd backend
npm install
npm run dev
```

### Running the Frontend Alone
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints Reference (Backend)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new STARTUP or INVESTOR account |
| `POST` | `/api/auth/login` | Authenticate user and issue `sf_session` cookie |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Return authenticated user details |
| `GET` | `/api/dashboard?view=...` | Return metrics and lists for founder/investor dashboard |
| `GET` / `POST` | `/api/data?type=...` | CRUD records (startups, investors, funding, investments, meetings) |
| `GET` / `POST` | `/api/preferences` | Get or update investor investment criteria |
| `GET` | `/api/match` | Fetch ranked investor/startup matches |
| `POST` | `/api/match` | Execute the weighted matching engine algorithm |
| `PATCH` | `/api/match/:matchId` | Accept or reject a match result |
| `GET` / `POST` | `/api/negotiations` | List or initiate term sheet negotiations |
| `GET` / `PATCH` | `/api/negotiations/:id` | View thread/history or submit counter-offer/accept/reject |
| `GET` / `POST` | `/api/pitch-decks` | Store pitch deck metadata (MySQL) and text (MongoDB) |
| `GET` | `/api/pitch-decks/search?q=...` | Full-text and keyword search across pitch decks in MongoDB |
| `GET` | `/api/health` | Health check for MySQL and MongoDB connections |
