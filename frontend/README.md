# VentureLink — Frontend Web Application

This folder contains the Next.js 14+ App Router frontend client for VentureLink. It provides responsive user interfaces tailored for Startup Founders, Angel/VC Investors, and Administrators.

## Features

- **Role-Tailored Dashboards**:
  - **Founder Dashboard**: Capital raised vs target, funding round progress bars, deal negotiations, investor match cards.
  - **Investor Portfolio Dashboard**: Capital deployed, portfolio distribution, active term sheet deal flow, investment criteria summary.
  - **Perspective Switcher**: Switch views instantly for evaluation and presentations.
- **Directories & Management**:
  - Startups, Investors, Funding Rounds, Investments, Meetings.
- **Investor Preference Configuration**:
  - Filter by industry, funding stage, min/max ticket sizes.
- **Interactive Deal Negotiations**:
  - Real-time counter-offers, equity and valuation computations, and deal acceptance with MongoDB timeline audit.
- **Document Intelligence**:
  - Pitch deck storage and MongoDB text/keyword search.
- **Authentication**:
  - Registration and login forms with secure cookie-based session tokens.

## Architecture

The frontend is completely decoupled from database drivers. All API calls (`fetch('/api/...')`) are automatically proxied to the VentureLink Express backend (`http://localhost:5000`) via Next.js rewrites defined in `next.config.mjs`.

## Project Structure

```
frontend/
├── app/
│   ├── dashboard/page.tsx     # Role-aware dashboard
│   ├── funding/page.tsx       # Funding rounds
│   ├── investments/page.tsx   # Finalized investments
│   ├── investors/page.tsx     # Investor directory
│   ├── login/page.tsx         # Sign in
│   ├── matches/page.tsx       # Matching engine UI
│   ├── meetings/page.tsx      # Meeting scheduler & notes
│   ├── negotiations/page.tsx  # Term sheet negotiation UI
│   ├── pitch-decks/page.tsx   # Pitch deck management & search
│   ├── preferences/page.tsx   # Investor criteria settings
│   ├── register/page.tsx      # Account creation
│   ├── startups/page.tsx      # Startup profiles
│   ├── globals.css            # Platform styles & responsive CSS
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Redirect to login or dashboard
├── components/
│   ├── AppShell.tsx           # Role-based navigation sidebar & header
│   └── DataPage.tsx           # Generic CRUD interface for entities
├── lib/
│   └── auth.ts                # Client & Server Component JWT verification
├── .env.example
├── .env.local
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## Setup & Running

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```env
   PORT=3000
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   BACKEND_INTERNAL_URL=http://localhost:5000
   JWT_SECRET=your_long_secret_key
   ```

3. **Start the Frontend Development Server**:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:3000`. Ensure the backend server is also running on port 5000.
