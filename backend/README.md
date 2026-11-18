# VentureLink — Backend API Server

This folder contains the standalone backend REST API server for VentureLink. It handles database connections to **MySQL** (relational) and **MongoDB** (NoSQL), user authentication via JWT cookies, the matching engine algorithm, term sheet negotiation state transitions with ACID transactions, activity auditing, and pitch deck document search.

## Features

- **Express.js REST API**: Clean, modular route handlers for all application operations.
- **Dual-Database Support**:
  - **MySQL**: Relational data models, foreign keys, triggers, ACID transactions (deal acceptance), and aggregate statistics.
  - **MongoDB**: Searchable pitch deck content/keywords, unstructured negotiation timeline threads, and activity audit logs.
- **Authentication**: Bcrypt password hashing and JWT token generation stored in HTTP-only cookies (`sf_session`).
- **Matching Engine**: Weighted compatibility scoring algorithm matching startups with investor preferences.
- **ACID Transactions**: Financial deal finalizing from negotiations into investment records.

## Project Structure

```
backend/
├── src/
│   ├── lib/
│   │   ├── audit.ts          # MongoDB activity logging
│   │   ├── auth.ts           # JWT token generation & verification
│   │   ├── db.ts             # MySQL pool and MongoDB client
│   │   └── negotiations.ts   # Negotiation database setup & Mongo threads
│   ├── middleware/
│   │   └── auth.ts           # requireAuth and optionalAuth Express middleware
│   ├── routes/
│   │   ├── auth.ts           # /api/auth (register, login, logout, me)
│   │   ├── dashboard.ts      # /api/dashboard (stats for founders & investors)
│   │   ├── data.ts           # /api/data (startups, investors, rounds, meetings, investments)
│   │   ├── health.ts         # /api/health (MySQL & MongoDB connectivity check)
│   │   ├── match.ts          # /api/match (ranked matching & engine run)
│   │   ├── negotiations.ts   # /api/negotiations (counter-offers & deal acceptance)
│   │   ├── pitchDecks.ts     # /api/pitch-decks (save deck & text search)
│   │   └── preferences.ts    # /api/preferences (investor investment criteria)
│   └── server.ts             # Main Express server entry point
├── database/
│   ├── database.sql          # Primary MySQL schema and seed data
│   ├── triggers.sql          # MySQL triggers for constraints and calculations
│   └── venturelink_backup.sql# Database backup dump
├── tests/
│   └── manual-test-cases.md  # Comprehensive test checklist
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── package.json
└── tsconfig.json
```

## Setup & Running

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and verify your MySQL and MongoDB credentials:
   ```env
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=startup_funding_platform
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DATABASE=startup_funding_nosql
   JWT_SECRET=your_long_secret_key
   ```

3. **Database Initialization**:
   Ensure MySQL is running and import the database scripts:
   ```bash
   mysql -u root -p < database/database.sql
   mysql -u root -p < database/triggers.sql
   ```

4. **Start the Backend Server**:
   - Development mode (with live reload):
     ```bash
     npm run dev
     ```
   - Production build:
     ```bash
     npm run build
     npm start
     ```
   The backend runs on `http://localhost:5000`.
