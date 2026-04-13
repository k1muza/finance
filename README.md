# District Finance Dashboard

A multi-tenant finance dashboard built with Next.js and Supabase for tracking district income, expenditure, and statement exports.

## What It Does

- Record income transactions per district
- Record expenditure transactions per district
- Manage reusable income and expenditure categories
- Switch between all-district and single-district views as an admin
- Export income and expenditure statements as CSV, DOCX, and PDF
- Import districts, income, and expenditure from CSV

## Roles

| Role | Access |
|------|--------|
| `admin` | View all districts, switch scope, manage imports, manage districts |
| `district` | View and manage finance data for their own district |

Authentication is handled with Supabase Auth. Route protection is enforced for all `/dashboard/*` paths.

## Tech Stack

- Next.js 16 App Router
- React 19
- Supabase (PostgreSQL + Auth)
- Tailwind CSS 4
- `docx` for Word statement exports
- `@react-pdf/renderer` for PDF statement exports

## Getting Started

### Prerequisites

- Node.js 18+
- A dedicated Supabase project for this finance app

### Install

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NEXT_PUBLIC_REGISTRATION_ENABLED=false
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the browser.

### Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Main Routes

- `/dashboard/overview`
- `/dashboard/finance/expenditure`
- `/dashboard/finance/income`
- `/dashboard/finance/reports`
- `/dashboard/settings`

## Supported API Endpoints

- `POST /api/auth/register`
- `POST /api/import/districts`
- `POST /api/import/income`
- `POST /api/import/expenses`
- `GET /api/reports/ie-docx`
- `GET /api/reports/ie-pdf`
- `GET /api/routes`

## Database Scope

The finance app is built around these core tables:

- `districts`
- `profiles`
- `income`
- `expenses`
- `income_categories`
- `expense_categories`

Conference-specific tables and mobile content APIs are intentionally out of scope for this product.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed:admin
```
