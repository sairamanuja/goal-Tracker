# GoalTrack Portal

A full-stack employee goal-setting and performance tracking portal built for the **AtomQuest Hackathon 1.0**. Covers the complete goal lifecycle — creation, manager approval, quarterly achievement logging, check-ins, and analytics — across three user roles.

### Documentation map

| Document | Best for | Contents |
|---|---|---|
| **[README.md](./README.md)** (you are here) | Running and deploying the app | Features, tech stack, install, env vars, project layout, demo credentials |
| **[SUBMISSION_ARCHITECTURE.md](./SUBMISSION_ARCHITECTURE.md)** | Hackathon / product review | Requirement matrix (10/10 + bonuses), unified control flow, competitive summary |
| **[arch.md](./arch.md)** | Deep technical review | Layers, auth & data flows, workflows, decision trees, DB relationships, routing |

**Where to start:** local setup → this README · requirement compliance → [SUBMISSION_ARCHITECTURE.md](./SUBMISSION_ARCHITECTURE.md) · implementation detail → [arch.md](./arch.md)

---

## Table of Contents

- [Documentation map](#documentation-map)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [User Roles & Flows](#user-roles--flows)
- [Bonus Features](#bonus-features)
- [Demo Credentials](#demo-credentials)
- [Deployment](#deployment)

---

## Features

### Phase 1 — Goal Setting & Approval
- Employees create goals with Thrust Area, Title, Description, UoM type, Target, and Weightage
- System-enforced validation: total weightage = 100%, minimum 10% per goal, maximum 8 goals per cycle
- Manager (L1) review workflow: inline edit of targets/weightages, approve or return with comment
- Goals are locked on approval — edits require Admin intervention with full audit trail
- **Shared Goals**: Admin/Manager pushes a KPI to multiple employees; recipients adjust weightage only; achievement updates sync automatically from the primary owner to all linked copies

### Phase 2 — Achievement Tracking & Check-ins
- Quarterly achievement logging (Planned vs. Actual) per goal, per quarter (Q1–Q4)
- Status tracking: Not Started / On Track / Completed
- System-computed progress scores per UoM formula (tracking only, not ratings):

| UoM Type | Formula |
|---|---|
| Numeric / % — Min (higher is better) | Achievement ÷ Target × 100 |
| Numeric / % — Max (lower is better) | Target ÷ Achievement × 100 |
| Timeline | Completion date ≤ Deadline → 100%, else 0% |
| Zero | Actual = 0 → 100%, else 0% |

- Manager check-in module: view Planned vs. Actual for each direct report, add structured quarterly comments
- Configurable check-in windows enforced by cycle dates with admin force-open override

### Reporting & Governance
- Achievement report exportable as **XLSX** with Goals and Achievements sheets
- Real-time Completion Dashboard: department-level heatmap + manager check-in rates
- Full audit trail: every post-lock change captures actor, field, old value, new value, timestamp

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | Base UI (`@base-ui/react`) + shadcn/ui v4 |
| Charts | Recharts |
| Auth | NextAuth.js v5 (beta) — JWT, Credentials + Azure AD |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Prisma 7.8 |
| Email | Resend |
| Teams Notifications | Microsoft Teams Incoming Webhooks |
| Icons | Lucide React |
| Validation | Zod |
| Toasts | Sonner |
| Excel Export | xlsx |
| Deployment | Vercel |

---

## Architecture

```
Browser
  │
  ▼
Next.js App Router (Vercel Edge / Node)
  ├── Server Components  ← fetch data directly, no API round-trip
  ├── Server Actions     ← mutations (goal CRUD, approvals, achievements)
  ├── API Routes         ← XLSX export, escalation cron endpoint
  └── Client Components ← interactive UI (forms, charts, notification bell)
  │
  ▼
Prisma ORM
  │
  ▼
Neon (serverless PostgreSQL)

External Services
  ├── Microsoft Entra ID  ← SSO + org hierarchy sync
  ├── Microsoft Graph API ← manager lookup, group-based role assignment
  ├── Resend              ← transactional email
  └── Teams Webhook       ← adaptive card notifications with deep links

Vercel Cron (daily 08:00 UTC)
  └── /api/admin/run-escalations  ← rule-based escalation engine
```

**More architecture detail:** layered diagrams, per-role workflows, and decision trees → [arch.md](./arch.md). Hackathon requirement mapping and simplified end-to-end control flow → [SUBMISSION_ARCHITECTURE.md](./SUBMISSION_ARCHITECTURE.md).

**Key architectural decisions:**
- Server Components fetch data at request time — no client-side data fetching for page loads
- `unstable_cache` with 60s TTL wraps heavy admin queries (analytics, reports) to reduce Neon cold-start latency
- All mutations are Server Actions — no REST endpoints except XLSX export and the cron endpoint
- Notifications are fire-and-forget (`void async IIFE`) so email/Teams failures never block the user-facing response

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) account (free tier works)
- A [Resend](https://resend.com) account for email (free tier: 3,000 emails/month)

### Installation

```bash
git clone <repo-url>
cd goaltrack
npm install
```

### Configure environment

```bash
cp .env.example .env
# Fill in the required values — see Environment Variables below
```

### Set up the database

```bash
npx prisma db push     # creates all tables in your Neon database
npx prisma generate    # generates the Prisma client
```

### Run locally

```bash
npm run dev
# open http://localhost:3000
```

---

## Environment Variables

```env
# ── Required ───────────────────────────────────────────────────────────────────

# Neon PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# NextAuth — generate with: openssl rand -base64 32
AUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# ── Email (Resend) ─────────────────────────────────────────────────────────────
# Sign up at resend.com → API Keys → Create key
# Without RESEND_API_KEY, email notifications are silently skipped
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
RESEND_FROM="GoalTrack <onboarding@resend.dev>"

# ── Microsoft Entra ID (optional — enables SSO + org sync) ────────────────────
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="common"
# Real org tenant GUID — required for app-token flows (org sync, group role mapping)
# Azure portal → Azure Active Directory → Overview → Tenant ID
AZURE_AD_ORG_TENANT_ID="your-org-tenant-guid"

# ── Microsoft Teams (optional — enables adaptive card notifications) ────────────
# Create an Incoming Webhook in Teams → copy the URL here
TEAMS_WEBHOOK_URL="https://your-org.webhook.office.com/webhookb2/..."
```

> All integrations (email, Teams, Entra ID) degrade gracefully — the portal is fully functional without them.

---

## Database Setup

### Schema overview

| Model | Purpose |
|---|---|
| `User` | Employees, Managers, Admins with org hierarchy (`managerId`) |
| `GoalCycle` | Annual cycles with per-quarter open/close windows |
| `Goal` | Individual goals linked to a cycle and user |
| `Achievement` | Quarterly actuals, completion dates, computed scores |
| `CheckIn` | Manager quarterly feedback comments |
| `AuditLog` | Immutable change log for post-lock edits |
| `Notification` | In-app notification store per user |
| `EscalationRule` | Configurable escalation triggers |
| `Escalation` | Escalation instances raised per rule |

### Push schema to database

```bash
npx prisma db push
```

### Seed demo data

Open Prisma Studio to manually insert users and a cycle:

```bash
npx prisma studio
```

Minimum seed for a working demo:
1. Create an Admin user, a Manager user, and one or more Employee users
2. Set `managerId` on each Employee pointing to the Manager's `id`
3. Create a `GoalCycle` with status `ACTIVE` and appropriate date windows

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, unauthorized pages
│   ├── (dashboard)/
│   │   ├── admin/           # dashboard, analytics, audit-log, cycles,
│   │   │                    # escalations, reports, shared-goals, users
│   │   ├── employee/        # goals (list / detail / achievement), check-ins
│   │   ├── manager/         # dashboard, team, check-in, shared-goals
│   │   └── layout.tsx       # shared layout with sidebar + topbar
│   ├── api/
│   │   ├── admin/run-escalations/  # Vercel Cron endpoint (daily 08:00 UTC)
│   │   ├── auth/                   # NextAuth handlers
│   │   └── reports/export/         # XLSX download
│   ├── error.tsx            # route-level error boundary
│   ├── global-error.tsx     # root error boundary
│   └── not-found.tsx        # 404 page
│
├── actions/                 # Server Actions (all mutations)
│   ├── goal-actions.ts      # create, update, delete, submit
│   ├── approval-actions.ts  # approve, return, manager inline edit
│   ├── achievement-actions.ts
│   ├── check-in-actions.ts
│   ├── shared-goal-actions.ts
│   ├── admin-actions.ts     # cycle management, user management, unlock
│   └── notification-actions.ts
│
├── components/
│   ├── analytics/           # TrendsChart, CompletionHeatmap,
│   │                        # EffectivenessTable, DistributionCharts
│   ├── goals/               # GoalForm, AchievementTabs, StatusBadge,
│   │                        # SubmitSheetButton, DeleteGoalButton
│   ├── layout/              # Sidebar, Topbar, NotificationBell,
│   │                        # SidebarProvider, Breadcrumb
│   ├── shared/              # ConfirmDialog, PageSkeleton
│   └── ui/                  # Avatar, Button, Card, Dialog, Dropdown,
│                            # Input, Select, Tabs, Tooltip, ...
│
├── lib/
│   ├── auth.ts              # NextAuth config (Credentials + AzureAD)
│   ├── auth-guard.ts        # requireAuth / requireAdmin / requireManager
│   ├── create-notification.ts
│   ├── escalations.ts       # rule engine: NOT_SUBMITTED, NOT_APPROVED,
│   │                        # CHECKIN_MISSED — 3 levels each
│   ├── graph.ts             # Microsoft Graph API utilities
│   ├── notifications.ts     # Resend email + Teams webhook helpers
│   ├── prisma.ts            # Prisma client singleton
│   ├── scoring.ts           # computeScore for all 4 UoM types
│   └── validation.ts        # Zod schemas
│
└── generated/prisma/        # Auto-generated Prisma client (do not edit)
```

---

## User Roles & Flows

### Employee
1. Log in → **My Goals** → **+ New Goal** → fill Thrust Area, Title, UoM, Target, Weightage → Save
2. Add all goals; the weightage bar shows the running total toward 100%
3. Once total = 100% → **Submit Goal Sheet** (confirm dialog shows goal count + weightage)
4. After manager approval, goals lock — go to **Goals → View → Achievement** each quarter to log actuals
5. Read manager feedback in **Check-Ins**

### Manager (L1)
1. Log in → **My Team** → click an employee row
2. Review submitted goal sheet; edit Target or Weightage inline if needed
3. **Approve** (all goals lock, employee notified) or **Return** with a mandatory comment (employee revises and re-submits)
4. Each quarter → **Check-In** for a direct report → view Planned vs. Actual → write structured comment
5. **Shared Goals** → push a departmental KPI to selected direct reports

### Admin / HR
1. **Cycles** → create and activate an annual cycle with per-quarter date windows; use Force Open to unlock a quarter outside its scheduled window
2. **Users** → manage roles, departments, manager assignments; one-click sync org hierarchy from Entra ID
3. **Shared Goals** → push goals across the organisation to multiple employees at once
4. **Reports** → filter by department / thrust area → export XLSX with two sheets (Goals + Achievements)
5. **Analytics** → QoQ trend chart, Completion Dashboard, goal distribution, manager effectiveness table
6. **Audit Log** → searchable, filterable record of every post-lock change (who, what, when)
7. **Escalations** → view active escalation instances; rules fire automatically each day via Vercel Cron

---

## Bonus Features

### Microsoft Entra ID (Azure AD) SSO
- Single Sign-On via the NextAuth AzureAD provider
- Manager hierarchy auto-resolved from Graph API (`/users/{oid}/manager`)
- Roles assigned from Azure AD group membership: `GoalTrack-Admins`, `GoalTrack-Managers`
- One-click **Sync from Entra ID** in Admin → Users page pulls the full org chart

### Email & Teams Notifications

| Event | Email | Teams Adaptive Card |
|---|---|---|
| Goal sheet submitted | Manager ✅ | Manager ✅ |
| Goal sheet approved | Employee ✅ | — |
| Goal sheet returned | Employee ✅ | Employee ✅ |
| Quarter opened | All employees ✅ | — |
| Goal unlocked by Admin | Employee ✅ | — |
| Check-in submitted | Employee ✅ | — |

All events also create an **in-app notification** (bell icon, top-right) with unread count badge, per-item mark-read with deep-link navigation, and mark-all-read.

### Escalation Engine

Three configurable rule types with three escalation levels each:

| Rule | Trigger | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| `NOT_SUBMITTED` | Employee hasn't submitted goals | 7 days | 14 days | 21 days |
| `NOT_APPROVED` | Manager hasn't approved submitted goals | 5 days | 10 days | 15 days |
| `CHECKIN_MISSED` | Manager hasn't filed a quarterly check-in | 10 days | 20 days | 30 days |

Runs automatically every day at **08:00 UTC** via Vercel Cron (`vercel.json`). Visible and filterable in Admin → Escalations.

### Analytics Dashboard
- **QoQ Trend Chart** — weighted achievement scores per employee across Q1–Q4
- **Completion Dashboard** — department heatmap (goals set / submitted / approved / Q1–Q4 actuals) + per-manager check-in completion rates
- **Distribution Charts** — goal breakdown by Thrust Area, UoM type, and status per department
- **Manager Effectiveness** — check-in rate and team average score per L1 manager with bar chart comparison

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin / HR | `admin@goaltrack.com` | `Password@123` |
| Manager | `manager@goaltrack.com` | `Password@123` |
| Employee | `emp@goaltrack.com` | `Password@123` |

> Microsoft SSO is also available if Entra ID is configured.

---

## Deployment

### Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Add all environment variables in **Vercel → Project Settings → Environment Variables**.

The `vercel.json` configures the daily escalation cron:

```json
{
  "crons": [
    {
      "path": "/api/admin/run-escalations",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Vercel automatically injects `CRON_SECRET` and sends it as `Authorization: Bearer <secret>` with each scheduled call — no manual token configuration needed.

### Production checklist

- [ ] Set `NEXTAUTH_URL` to your production domain
- [ ] Generate a strong `AUTH_SECRET`: `openssl rand -base64 32`
- [ ] Add redirect URI `https://yourdomain.com/api/auth/callback/azure-ad` in the Azure portal
- [ ] Verify a sending domain in Resend and update `RESEND_FROM`
- [ ] Set `AZURE_AD_ORG_TENANT_ID` to your real org tenant GUID for Graph org sync
- [ ] Add a Teams Incoming Webhook URL for Teams notifications

---

## License

Built for AtomQuest Hackathon 1.0. All rights reserved.
