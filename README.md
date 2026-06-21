# EventTix - Event Ticketing Platform

A full-stack event management and ticketing application built with **React**, **Node.js (Express)**, and **PostgreSQL**.

## Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Frontend    | React 18, React Router 6, Vite, Axios  |
| Backend     | Node.js 20, Express 4, JWT, Zod        |
| Database    | PostgreSQL 16                           |
| Deployment  | Docker, Docker Compose, Nginx, Let's Encrypt |

## Project Structure

```
event-ticketing/
├── backend/          # Node.js Express API (separate codebase)
│   ├── src/
│   │   ├── config/       # App & DB configuration
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── models/       # Database queries
│   │   ├── routes/       # Express route definitions
│   │   ├── services/     # Business logic
│   │   └── utils/        # Helpers & error classes
│   ├── migrations/       # SQL migration files
│   ├── seeds/            # Demo data seeder
│   └── Dockerfile
├── frontend/         # React SPA (separate codebase)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React context providers
│   │   ├── pages/        # Route page components
│   │   └── services/     # API client (Axios)
│   ├── Dockerfile
│   └── nginx.conf        # Nginx config for production
└── deployment/       # Deployment & DevOps
    ├── docker-compose.yml
    ├── nginx/            # Production Nginx config
    └── scripts/          # Deploy & backup scripts
```

## Features

- **Event Management** - Create, publish, and manage events with multiple ticket tiers
- **Ticket Booking** - Select quantities, real-time availability checks, atomic transactions
- **User Authentication** - JWT-based auth with role-based access (attendee, organizer, admin)
- **Dashboard** - User booking history, admin event & booking management
- **Responsive UI** - Mobile-friendly, modern design
- **Security** - Helmet, rate limiting, input validation (Zod), SQL injection protection

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### 1. Database Setup

```bash
createdb event_ticketing
psql -d event_ticketing -f backend/migrations/001_initial.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # Edit with your DB credentials
npm install
npm run seed            # Create demo data
npm run dev             # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # http://localhost:3000
```

### Demo Credentials (after seeding)

| Role       | Email                   | Password        |
|------------|-------------------------|-----------------|
| Admin      | admin@eventtix.com      | (set in .env)   |
| Organizer  | organizer@eventtix.com  | Organizer@123   |
| Attendee   | attendee@eventtix.com   | Attendee@123    |

---

## Production Deployment (Linux Server)

> See [deployment/README.md](deployment/README.md) for the complete deployment guide including:
> - One-command Ubuntu setup
> - Docker Compose orchestration
> - Nginx + SSL (Let's Encrypt)
> - Database backup automation
> - Monitoring & maintenance
> - CI/CD recommendations
