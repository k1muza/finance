# Conference Dashboard

A multi-tenant conference management dashboard built with Next.js for managing the ZAOGA FIF Easter Conference. It powers both the web admin interface and a companion mobile app via REST APIs.

## Features

- **Overview** — Summary stats: attendee count, total funds raised, expenses, net balance, and top contributors
- **Schedule** — Manage conference days, sessions, events, and meal times with a timeline view
- **People** — Add/edit/delete attendees; filter by name, gender, region, or department; track individual contributions
- **Departments** — Create departments, assign heads of department, and manage members
- **Regions** — Hierarchical view of districts and regions with leadership roles
- **Leaderboard** — Ranked contributor list with certificate tiers and configurable thresholds
- **Pages** — Create and publish rich-text content pages (with images and icons) to the mobile app
- **Songs** — Song library with lyrics, author, and key
- **Expenses** — Track conference expenses per district
- **Notifications** — Send FCM push notifications to mobile app users
- **Publish API** — Interactive API reference for the 9 mobile-facing REST endpoints

## Multi-Tenancy

Two roles control data visibility:

| Role | Access |
|------|--------|
| `admin` | All districts |
| `district` | Own district only |

Authentication is handled via Supabase Auth (email/password). Middleware enforces route protection on all `/dashboard/*` paths.

## Tech Stack

- **Framework** — Next.js 16.2.1 (App Router), React 19
- **Database** — Supabase (PostgreSQL)
- **Styling** — Tailwind CSS 4, `next-themes` (dark/light mode)
- **Rich Text** — TipTap
- **Push Notifications** — Firebase Admin SDK (FCM)
- **Icons** — Lucide React, MDI Font
- **Utilities** — date-fns, clsx, tailwind-merge

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Firebase](https://firebase.google.com) project (for push notifications)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firebase (push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

> `SUPABASE_SERVICE_ROLE_KEY` is server-only and has full database access — never expose it to the browser.

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Mobile App API

The dashboard exposes read-only JSON endpoints for the companion mobile app under `/api/data/*`:

| Endpoint | Description |
|----------|-------------|
| `GET /api/data/people` | Attendees |
| `GET /api/data/days` | Conference days |
| `GET /api/data/sessions` | Sessions per day |
| `GET /api/data/events` | Events per session |
| `GET /api/data/meals` | Meal schedule |
| `GET /api/data/departments` | Departments |
| `GET /api/data/regions` | Regions |
| `GET /api/data/songs` | Song library |
| `GET /api/data/pages` | Published content pages |

Push notification device tokens can be registered at `POST /api/notifications/register`.

## Database Schema (ERD)

```mermaid
erDiagram
    districts {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    regions {
        uuid id PK
        uuid district_id FK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    departments {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    people {
        uuid id PK
        text name
        text phone UK
        text gender
        uuid region_id FK
        uuid department_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    contributions {
        uuid id PK
        uuid person_id FK
        numeric amount
        text note
        date date
        timestamptz created_at
    }

    district_roles {
        uuid id PK
        uuid district_id FK
        uuid person_id FK
        text role
        timestamptz created_at
    }

    region_roles {
        uuid id PK
        uuid region_id FK
        uuid person_id FK
        text role
        timestamptz created_at
    }

    department_roles {
        uuid id PK
        uuid department_id FK
        uuid person_id FK
        text role
        timestamptz created_at
    }

    days {
        uuid id PK
        uuid district_id FK
        date date UK
        text label
        timestamptz created_at
        timestamptz updated_at
    }

    sessions {
        uuid id PK
        uuid day_id FK
        text name UK
        time start_time
        integer allocated_duration
        timestamptz created_at
        timestamptz updated_at
    }

    events {
        uuid id PK
        uuid session_id FK
        text title
        time start_time
        integer duration
        timestamptz created_at
        timestamptz updated_at
    }

    event_people {
        uuid event_id FK
        uuid person_id FK
    }

    meals {
        uuid id PK
        uuid day_id FK
        text name
        time scheduled_time
        integer duration
        timestamptz created_at
        timestamptz updated_at
    }

    expenses {
        uuid id PK
        uuid district_id FK
        text description
        numeric amount
        date date
        timestamptz created_at
        timestamptz updated_at
    }

    districts ||--o{ regions : "has"
    districts ||--o{ days : "has"
    districts ||--o{ expenses : "has"
    districts ||--o{ district_roles : "has"
    regions ||--o{ people : "belongs to"
    regions ||--o{ region_roles : "has"
    departments ||--o{ people : "belongs to"
    departments ||--o{ department_roles : "has"
    people ||--o{ contributions : "makes"
    people ||--o{ district_roles : "holds"
    people ||--o{ region_roles : "holds"
    people ||--o{ department_roles : "holds"
    people ||--o{ event_people : "assigned to"
    days ||--o{ sessions : "contains"
    days ||--o{ meals : "contains"
    sessions ||--o{ events : "contains"
    events ||--o{ event_people : "has"
```

> `person_roles.entity_type` is either `'district'` or `'region'`; `entity_id` points to the corresponding table. A DB trigger enforces that the person must be a member of the entity before a role can be assigned.

## Project Structure

```
src/
├── app/
│   ├── api/          # REST API routes (data + notifications)
│   ├── dashboard/    # All dashboard pages
│   └── login/        # Auth page
├── components/       # Reusable UI and feature components
├── contexts/         # AuthContext (session + profile)
├── hooks/            # Data-fetching hooks per entity
└── lib/
    └── supabase/     # Browser and server Supabase clients
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Lint the codebase
```
