# VentureLink — Startup Funding & Investor Matching Platform

A Next.js web application for the DBMS Level 3 project. It uses **MySQL + MongoDB** (two database paradigms), with a weighted startup–investor matching workflow and a responsive web UI.

## Features

- Account registration and login with bcrypt password hashing and HTTP-only JWT cookie.
- Role field for STARTUP, INVESTOR and ADMIN accounts.
- Startup directory, investor directory, funding rounds and meeting records.
- Investor preference settings (industry, preferred funding stage, min/max ticket size).
- Weighted matching engine: baseline score + industry fit + stage fit + ticket-size fit; results are stored in MySQL and ranked in the UI.
- Pitch-deck reference records stored in MySQL; pitch text and keyword arrays stored in MongoDB, with text/keyword search.
- MongoDB activity log for login, record creation, matching runs and pitch-deck activity.
- Dashboard counts and capital invested.

## Technology

- Frontend: Next.js 14 App Router, React, TypeScript, CSS.
- Backend/API: Next.js Route Handlers.
- Relational database: MySQL (`startup_funding_platform`).
- NoSQL database: MongoDB (`startup_funding_nosql`).

## Requirements

- Node.js 18.17+ (Node 20 LTS recommended)
- MySQL 8+
- MongoDB Community Server or MongoDB Atlas

## Setup

1. Install MySQL and start the MySQL server.
2. Open MySQL Command Line Client and run the database script:

   ```sql
   SOURCE /absolute/path/to/database.sql;
   ```

   Run it using the MySQL command-line client because the script includes a `prompt` client command for the custom prompt used in the demo. If using a GUI client, remove/comment out the `prompt mysql [startup_funding_platform]>` line first.
3. Start MongoDB locally, or create a MongoDB Atlas database.
4. Copy `.env.example` to `.env.local` and enter your actual MySQL password and MongoDB URI. Set a long random `JWT_SECRET`.
5. In this project folder run:

   ```bash
   npm install
   npm run dev
   ```
6. Open `http://localhost:3000`.
7. Choose **Create an account**. Register as a Startup or Investor, then sign in. The sample SQL accounts have placeholder password hashes and are sample data only; create your own login using the registration screen.

## First-time data entry

- Add an industry row if you need an industry not in the sample list. Use its `industry_id` in the startup form.
- Add startup profiles and investor profiles. For the investor profile, use the account that should own it.
- Investors can set their preferences at **Investor preferences** after creating their investor profile.
- Add funding rounds, investments and meetings using the corresponding IDs displayed in the database.
- Add a pitch deck with a URL/reference and paste extracted pitch text into the text area. MySQL stores the deck record; MongoDB stores the text and searchable keywords.
- Go to **Investor matches** and select **Run matching**.

## Database split and justification

**MySQL** stores structured, relational and integrity-sensitive data: users, startups, industries, investors, preferences, funding rounds, match results, investments, meetings, follow-ups and pitch-deck references. These records require foreign keys, unique constraints, joins, transactions and aggregate reporting.

**MongoDB** stores flexible, text-heavy pitch-deck content and activity logs. Pitch text does not have a fixed structure and is searched by text/keywords; audit events can have different detail fields. This makes a document database appropriate for this portion of the project.

## Important routes

- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `/api/data?type=startups|investors|funding|meetings`
- `/api/preferences`
- `/api/match` (GET ranked matches, POST run matching)
- `/api/pitch-decks` (GET/POST)
- `/api/pitch-decks/search?q=term`
- `/api/health` (database connectivity check)

## Security notes

- Passwords are hashed using bcrypt; never store plaintext passwords.
- Database credentials are read from environment variables, not source code.
- The session token is stored in an HTTP-only cookie.
- For a production deployment, add CSRF protection, rate limiting, stricter role/ownership checks, HTTPS, and a managed secret store.

## Project demonstration checklist

1. Register/login.
2. Show dashboard metrics.
3. Add or view startup and investor records.
4. Configure investor preferences.
5. Add funding round and meeting records.
6. Run matching and explain the weighted score.
7. Add a pitch deck, then search its text (MongoDB).
8. Show MySQL tables/joins and MongoDB collections.

## Team contribution

Update this section with the actual division of work and each member's Git commits before submission. Both members should be able to explain the database design and application flow.


## Complete submission materials
- `docs/PROJECT_REPORT.md` — project report.
- `docs/er_diagram.png` and `.dot` — ER diagram image/source.
- `docs/architecture.png` and `.dot` — architecture image/source.
- `docs/RELATIONAL_SCHEMA.md` — relational schema/data dictionary.
- `docs/mongodb_setup.js` — MongoDB collections and indexes.
- `tests/manual-test-cases.md` — test procedures and expected outcomes.
- `docs/DEMO_SCRIPT.md` — presentation sequence.

Before submission, run the tests locally and replace Pending with actual results/evidence. Add actual team member names and GitHub commit links. The project bundle cannot truthfully claim local execution or Git contributions that have not happened.
