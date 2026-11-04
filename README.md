# LeetCode Leaderboard

A full-stack web application designed to track, rank, and showcase competitive programming statistics for approved LeetCode users in a clean, sortable public leaderboard.

Visitors can view user statistics across multiple metrics and request to have their own profiles added. Administrators manage approvals, manual user additions, and background refresh schedules through a private, secure administrative dashboard.

---

## Features

### Public Leaderboard
- **Three Sortable Ranking Metrics**:
  - Total Problems Solved (with Easy / Medium / Hard breakdown)
  - Contest Rating
  - Contests Attended
- **Deterministic Tie-Breaking**: High-integrity secondary and tertiary sorting rules.
- **Search & Pagination**: Debounced search by username or display name with configurable rows per page (10, 25, 50, 100).
- **High Data Integrity**: Missing or unavailable statistics are displayed as `"—"`, never as invented zeros. Confirmed zeros display as `"0"`. Stale data indicators show when stats exceed refresh thresholds.
- **Visitor "Request to Add" Flow**: Simple modal enabling visitors to submit their LeetCode username and optional display name for administrator review.

### Administrator Portal (Private & Unlisted)
- **Secure Authentication**: Password-protected access using bcrypt hashing and secure session/JWT cookies.
- **Approved Users Management**: Searchable and sortable directory of approved profiles, with a single `+ Add User` button for manual profile addition, and confirmation-protected profile removal (archiving).
- **Pending Requests Queue**: Dedicated queue to approve or reject visitor join requests, complete with a real-time pending-count badge in the sidebar.
- **Settings & Refresh Controls**: Configurable background sync interval, concurrency limits, on-demand "Refresh All", and administrator password management.

---

## Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Vite | Light theme only, responsive, accessible |
| **Backend** | Node.js, Express, TypeScript (ESM) | REST API, Zod validation, rate limiting |
| **Database** | PostgreSQL | Versioned migrations, transaction-safe operations |
| **Data Provider** | LeetCode Public GraphQL | Isolated behind `ILeetCodeProvider` abstraction |
| **Background Sync** | `node-cron` worker | Bounded concurrency, backoff, stat preservation |
| **Security** | bcrypt, Helmet, HTTP-only cookies | Server-side authorization on all admin routes |

---

## Architecture Overview

The project is structured as a modular monorepo:

```
LeetCode_Dashboard/
├── client/                 # React 19 + TypeScript + Vite frontend
├── server/                 # Express + TypeScript backend (Phase 4)
├── shared/                 # Shared TypeScript interfaces and DTOs (optional)
├── AGENT/                  # Comprehensive technical documentation & AI prompts
│   ├── docs/               # 9 technical architecture and requirement specs
│   ├── prompts/            # 5 phase-by-phase AI implementation prompts
│   ├── AGENTS.md           # Master instruction manual for AI coding assistants
│   └── README.md           # Documentation index and recommended reading order
├── .gitignore              # Ignores secrets and build outputs (tracks AGENT/)
└── README.md               # Public project documentation (this file)
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher (LTS recommended)
- **PostgreSQL**: v15.x or higher
- **Package Manager**: `npm` or `pnpm`

### 1. Clone the Repository
```bash
git clone <repository-url>
cd LeetCode_Dashboard
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
```

### 3. Install Backend Dependencies (Phase 4)
```bash
cd ../server
npm install
```

### 4. Environment Configuration
Create a `.env` file in `server/` (or project root) based on `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/leetcode_leaderboard
JWT_SECRET=replace_with_a_secure_random_32_char_secret
SESSION_SECRET=replace_with_a_secure_random_32_char_secret
REFRESH_INTERVAL_HOURS=6
REFRESH_CONCURRENCY_LIMIT=3
```

### 5. Run Database Migrations (Phase 4)
```bash
cd server
npm run migrate
npm run seed:admin
```

---

## Development & Testing Commands

### Frontend (`client/`)
```bash
# Start Vite development server (default: http://localhost:5173)
npm run dev

# Type check and build production bundle
npm run build

# Run linter
npm run lint
```

### Backend (`server/` — once initialized in Phase 4)
```bash
# Start backend API server with hot reload (default: http://localhost:3001)
npm run dev

# Run database migrations
npm run migrate

# Run automated test suites
npm run test:unit
npm run test:integration
npm run test:security
```

---

## Security Notes

- **Unlisted Administrative Route**: The administrator dashboard lives at an unlisted URL and is never linked on the public website.
- **Mandatory Server-Side Authorization**: Every administrative endpoint independently verifies the admin session on the server. UI visibility toggles are never relied upon for security.
- **Password Protection**: Passwords are saved exclusively as bcrypt hashes (cost factor ≥ 12).
- **Secrets Management**: No API keys, database credentials, or secret tokens are committed to source control. The `.env` file is excluded via `.gitignore`.
- **Documentation Tracking**: The `AGENT/` directory contains all technical specifications and is tracked in Git.

---

## Project Status

- [x] **Documentation System**: Complete, verified, and consistent across all specifications and prompts.
- [ ] **Phase 1 — Project Setup & Planning**: Ready to begin (see `AGENT/prompts/01_PROJECT_SETUP.md`).
- [ ] **Phase 2–3 — Public UI & Request Modal**: Pending.
- [ ] **Phase 4–7 — Backend APIs, Database & Admin Portal**: Pending.
- [ ] **Phase 8–13 — Provider Validation, Background Refresh, Tests & Deployment**: Pending.

For comprehensive technical specifications, API contracts, database schemas, and AI prompts, consult the [`AGENT/README.md`](AGENT/README.md) documentation index.
