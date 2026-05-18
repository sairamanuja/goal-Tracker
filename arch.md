# 🏗️ GOALTRACK PORTAL - COMPLETE SYSTEM ARCHITECTURE

> **Related documentation**
>
> | Document | Purpose |
> |---|---|
> | [README.md](./README.md) | Setup, environment variables, deployment, demo credentials |
> | [SUBMISSION_ARCHITECTURE.md](./SUBMISSION_ARCHITECTURE.md) | Hackathon requirement matrix, unified control flow, submission narrative |
> | **arch.md** (this file) | Full technical architecture — layers, flows, decision trees, schema |

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Data Flow](#data-flow)
4. [Authentication Flow](#authentication-flow)
5. [User Workflows](#user-workflows)
6. [Shared Goals Flow](#shared-goals-flow)
7. [Escalation Flow](#escalation-flow)
8. [Scoring Engine](#scoring-engine)
9. [Database Relationships](#database-relationships)
10. [Request Routing](#request-routing)
11. [Decision Trees](#decision-trees)
12. [Component Composition](#component-composition)

---

## System Overview

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                         GOALTRACK PORTAL - SYSTEM OVERVIEW                     ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────────────────────────────────┐
│                               PRESENTATION LAYER                               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │    EMPLOYEE PORTAL   │  │    MANAGER PORTAL    │  │     ADMIN PORTAL     │ │
│  ├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤ │
│  │ • Goal Setting       │  │ • Goal Approval      │  │ • Cycle Management   │ │
│  │ • Achievement Log    │  │ • Team Analytics     │  │ • User Management    │ │
│  │ • Check-in View      │  │ • Check-ins          │  │ • Org Sync (Entra)   │ │
│  │ • Shared Goals Mgmt  │  │ • Escalations        │  │ • Escalation Rules   │ │
│  │ • Notifications      │  │ • Reports            │  │ • Audit Logs         │ │
│  │ • Profile            │  │ • Notifications      │  │ • Unlock Goals       │ │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘ │
│             │                         │                         │             │
│             └─────────────────────────┼─────────────────────────┘             │
│                                       │                                       │
│                      (Next.js Server Components & Client Components)           │
│                      (React 19 + TypeScript + Tailwind CSS v4)                │
│                                                                                │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      │
┌─────────────────────────────────────▼────────────────────────────────────────┐
│                            BUSINESS LOGIC LAYER                               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │              Next.js Server Actions (State Mutations)                  │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │  ├─ goal-actions.ts                                                   │  │
│  │  │  └─ createGoal() → updateGoal() → submitGoal() → deleteGoal()      │  │
│  │  │                                                                     │  │
│  │  ├─ approval-actions.ts                                               │  │
│  │  │  └─ approveGoalSheet() → returnGoalSheet() → updateGoalAsManager()│  │
│  │  │                                                                     │  │
│  │  ├─ achievement-actions.ts                                            │  │
│  │  │  └─ saveAchievement() [Q1-Q4 with auto scoring]                   │  │
│  │  │                                                                     │  │
│  │  ├─ check-in-actions.ts                                               │  │
│  │  │  └─ submitCheckIn() [Manager quarterly comments]                  │  │
│  │  │                                                                     │  │
│  │  ├─ shared-goal-actions.ts                                            │  │
│  │  │  └─ pushSharedGoal() → updateWeightage() → syncAchievements()      │  │
│  │  │                                                                     │  │
│  │  ├─ admin-actions.ts                                                  │  │
│  │  │  └─ createCycle() → activateCycle() → closeCycle() → unlockGoal() │  │
│  │  │  → syncOrgFromEntraId() → updateUser()                            │  │
│  │  │                                                                     │  │
│  │  ├─ escalation-actions.ts                                             │  │
│  │  │  └─ resolveEscalation() → dismissEscalation()                     │  │
│  │  │                                                                     │  │
│  │  └─ notification-actions.ts                                           │  │
│  │     └─ markNotificationRead() → markAllNotificationsRead()           │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│  ┌────────────────────────────────────┼────────────────────────────────────┐  │
│  │         Core Business Logic Libraries                                   │  │
│  ├────────────────────────────────────┼────────────────────────────────────┤  │
│  │                                    │                                    │  │
│  │  auth.ts           graph.ts        │        scoring.ts                  │  │
│  │  ├─NextAuth.js     ├─Manager ID   ├─ Numeric UoM                       │  │
│  │  ├─JWT callback    ├─Org Groups   ├─ Percentage UoM                    │  │
│  │  ├─User upsert     ├─App Token    ├─ Timeline UoM                      │  │
│  │  └─Role mapping    └─Delegated    └─ Zero UoM                          │  │
│  │                       Token                                             │  │
│  │                                                                         │  │
│  │  validation.ts         escalations.ts    notifications.ts             │  │
│  │  ├─Goal schema        ├─Rule eval       ├─Email (Resend)             │  │
│  │  ├─Achievement schema ├─Status check    ├─Teams Webhooks             │  │
│  │  ├─User schema        └─Escalation      └─In-app DB records          │  │
│  │  └─Check-in schema       trigger                                       │  │
│  │                                                                         │  │
│  │  goal-rules.ts         cached-queries.ts     constants.ts             │  │
│  │  ├─Max 8 goals/cycle   ├─Query cache        ├─App-wide constants     │  │
│  │  ├─Min 10% weightage   ├─Revalidation       └─Enums, config          │  │
│  │  └─Total = 100%        └─Cache invalidation                           │  │
│  │                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      │ Prisma ORM
                                      │
┌─────────────────────────────────────▼────────────────────────────────────────┐
│                            DATA ACCESS LAYER                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                       Prisma Client (prisma.ts)                          │ │
│  │  ├─ Connection pooling                                                   │ │
│  │  ├─ Type-safe query builder                                              │ │
│  │  ├─ Transaction support                                                  │ │
│  │  └─ Prepared statements                                                  │ │
│  │                                                                            │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      │ SQL
                                      │
┌─────────────────────────────────────▼────────────────────────────────────────┐
│                          DATABASE LAYER                                        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│                    PostgreSQL (Neon - Serverless)                            │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        DATABASE SCHEMA                                  │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  Core Tables:                                                          │ │
│  │  ├─ users             [id, email, role, managerId, entraId, ...]      │ │
│  │  ├─ goalCycles        [id, name, year, status, dateWindows, ...]      │ │
│  │  ├─ goals             [userId, cycleId, title, weightage, status, ...] │ │
│  │  ├─ achievements      [goalId, quarter, planned, actual, score, ...]  │ │
│  │  └─ checkIns          [managerId, employeeId, quarter, comment, ...]  │ │
│  │                                                                         │ │
│  │  Governance Tables:                                                    │ │
│  │  ├─ auditLogs         [goalId, userId, action, oldValue, newValue, ...]│ │
│  │  ├─ escalationRules   [name, condition, daysAfter, level, ...]        │ │
│  │  ├─ escalations       [ruleId, targetId, status, resolvedAt, ...]     │ │
│  │  └─ notifications     [userId, type, title, body, read, ...]          │ │
│  │                                                                         │ │
│  │  Shared Goals:                                                         │ │
│  │  └─ (goals.sharedFromId → parent goal reference)                       │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │  Microsoft Graph API    │  │   Resend Email API   │  │  Teams Webhooks │  │
│  ├─────────────────────────┤  ├──────────────────────┤  ├─────────────────┤  │
│  │ • Manager lookup        │  │ • Transactional      │  │ • Adaptive Cards│  │
│  │ • Org hierarchy fetch   │  │   emails             │  │ • Deep links    │  │
│  │ • Group membership      │  │ • HTML templates     │  │ • Notifications │  │
│  │ • App token generation  │  │ • Delivery tracking  │  │ • Rich UI       │  │
│  │ • Delegated permissions │  │                      │  │                 │  │
│  └─────────────────────────┘  └──────────────────────┘  └─────────────────┘  │
│                                                                                │
│  ┌─────────────────────────┐  ┌──────────────────────┐                        │
│  │  Azure Entra ID (OAuth) │  │   Vercel Platform    │                        │
│  ├─────────────────────────┤  ├──────────────────────┤                        │
│  │ • SSO authentication    │  │ • Deployment         │                        │
│  │ • User provisioning     │  │ • Edge Functions     │                        │
│  │ • Group assignment      │  │ • Cron jobs (daily   │                        │
│  │ • Org claims (tid, oid) │  │   escalation eval)   │                        │
│  └─────────────────────────┘  └──────────────────────┘                        │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Complete Request/Response Cycle
**SCENARIO: Employee Submits Goal Sheet**

```
1️⃣  INITIATION (Browser)
    ┌──────────────────────────────────────────┐
    │ User clicks "Submit Goal Sheet" button    │
    │ Form validation (Zod) runs client-side   │
    │ Data serialized (JSON)                   │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
2️⃣  SERVER ACTION INVOCATION (Next.js)
    ┌──────────────────────────────────────────┐
    │ submitGoalSheet(userId, goalIds)         │
    │   ├─ Deserialize payload                 │
    │   └─ Extract from form FormData          │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
3️⃣  AUTHENTICATION CHECK
    ┌──────────────────────────────────────────┐
    │ auth() → getCurrentUser()                │
    │   ├─ Verify JWT session                  │
    │   ├─ Check expiry & signature            │
    │   └─ Return authenticated user           │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
4️⃣  BUSINESS RULE VALIDATION
    ┌──────────────────────────────────────────┐
    │ Validate via goal-rules.ts               │
    │   ├─ Check goal count ≤ 8                │
    │   ├─ Verify total weightage = 100%       │
    │   ├─ Check window is open                │
    │   └─ Throw ValidationError if fails      │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
5️⃣  DATA MUTATION (Prisma Transaction)
    ┌──────────────────────────────────────────┐
    │ prisma.$transaction([                    │
    │   goal.updateMany({                      │
    │     where: { id: { in: goalIds } },      │
    │     data: { status: 'SUBMITTED' }        │
    │   }),                                    │
    │   auditLog.createMany({                  │
    │     data: auditEntries                   │
    │   }),                                    │
    │   notification.create({...})             │
    │ ])                                       │
    │                                          │
    │ All-or-nothing atomic guarantee          │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
6️⃣  SIDE EFFECTS (Async, Fire-and-Forget)
    ┌──────────────────────────────────────────┐
    │ sendNotifications(async):                │
    │   ├─ sendEmailNotification()             │
    │   │  └─ Resend API → Email to manager    │
    │   ├─ sendTeamsNotification()             │
    │   │  └─ Teams Webhook → Manager Channel  │
    │   └─ (returns immediately)               │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
7️⃣  CACHE INVALIDATION
    ┌──────────────────────────────────────────┐
    │ revalidatePath('/dashboard/employee')    │
    │ revalidateTag('user-goals')              │
    │ revalidateTag('manager-pending-approvals')
    │                                          │
    │ Next.js regenerates affected pages       │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
8️⃣  RESPONSE TO CLIENT
    ┌──────────────────────────────────────────┐
    │ Return:                                  │
    │   ├─ success: true                       │
    │   ├─ message: "Goals submitted"          │
    │   ├─ redirectTo: '/dashboard/employee'   │
    │   └─ data: { submittedAt, ... }          │
    │                                          │
    │ Serialized as JSON                       │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
9️⃣  CLIENT STATE UPDATE
    ┌──────────────────────────────────────────┐
    │ Browser receives response                │
    │   ├─ Show toast notification             │
    │   ├─ Redirect to dashboard               │
    │   ├─ Trigger useTransition() state       │
    │   └─ Re-render with fresh data           │
    │                                          │
    │ User sees updated UI                     │
    └──────────────────────────────────────────┘
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Browser (Client Components)                                                 │
│  ├─ Interactive Forms (goal-form, check-in-form)                            │
│  ├─ Notification Bell (useCallback + markNotificationRead)                  │
│  ├─ Charts & Analytics (Recharts components)                                │
│  └─ Call Server Actions via form submission or onClick                      │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │ POST (serialized form data)
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Next.js Server Actions (src/actions/*.ts)                                   │
│  ├─ Validate auth: auth() session check                                     │
│  ├─ Enforce business rules (weightage validation, windows)                  │
│  ├─ Mutate via Prisma                                                       │
│  ├─ Send notifications (email, Teams, in-app)                               │
│  ├─ Create audit logs                                                       │
│  └─ Revalidate cache paths (revalidatePath, updateTag)                      │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │ Prisma queries
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Prisma ORM (src/lib/prisma.ts)                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │ SQL
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Neon PostgreSQL (serverless)                                                │
└─────────────────────────────────────────────────────────────────────────────┘

External Integrations:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Microsoft Graph API (graph.ts)                                              │
│  ├─ getGraphUserManagerEmail(oid, token) → user's manager                   │
│  ├─ getGraphUserGroups(oid, token) → org groups for role                    │
│  ├─ getAppTokenForTenant(tid) → client credentials flow                     │
│  └─ Called from auth.ts JWT callback on first login                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Notification Services                                                       │
│  ├─ Resend Email: sendEmailNotification() → transactional email             │
│  ├─ Teams: sendTeamsNotification() → Adaptive Cards w/ deep links           │
│  └─ In-App: createNotification() → DB Notification record                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Server Components (Server-side Rendering)                                   │
│  ├─ Fetch data directly (no API round-trip)                                 │
│  ├─ Pass data to Client Components as props                                 │
│  ├─ Can call auth() & Prisma directly                                       │
│  └─ Examples: DashboardLayout, admin pages, reports                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOGIN ENTRY POINT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User visits /auth/login

    │
    ├─ Option 1: Azure AD SSO
    │
    ├─────────────────────────────────────┐
    │ Click "Login with Microsoft"        │
    ├─────────────────────────────────────┤
    │                                     │
    │ NextAuth redirects to:              │
    │ https://login.microsoftonline.com   │
    │                                     │
    │ User authenticates with:            │
    │ • Username (email)                  │
    │ • Password                          │
    │ • MFA (if enabled in org)           │
    │                                     │
    │ Azure returns JWT with claims:      │
    │ • email, oid (object ID)            │
    │ • tid (tenant ID)                   │
    │ • groups (org group memberships)    │
    │                                     │
    └──────────────────┬──────────────────┘
                       │
                       ▼
    ┌────────────────────────────────────┐
    │ NextAuth JWT Callback Triggered    │
    ├────────────────────────────────────┤
    │                                    │
    │ Inside auth.ts:                    │
    │ ├─ Extract profile (email, oid)    │
    │ ├─ Get tenant ID (tid)             │
    │ ├─ Fetch app token:                │
    │ │  POST https://login.microsoftonline.com/..
    │ │  (client credentials flow)       │
    │ │                                  │
    │ │  If app token fails:             │
    │ │  └─ Fallback to delegated token  │
    │ │     (use user's token)           │
    │ │                                  │
    │ └─ Call Microsoft Graph API:       │
    │    GET /me/manager                 │
    │    └─ Get manager's email          │
    │    GET /me/getMemberObjects        │
    │    └─ Get user's group memberships │
    │       - GoalTrack-Admins?          │
    │       - GoalTrack-Managers?        │
    │       - Others?                    │
    │                                    │
    │ Map org groups → app roles:        │
    │ • In GoalTrack-Admins  → ADMIN     │
    │ • In GoalTrack-Managers→ MANAGER   │
    │ • Otherwise            → EMPLOYEE  │
    │                                    │
    └──────────────────┬─────────────────┘
                       │
                       ▼
    ┌────────────────────────────────────┐
    │ Upsert User in Database            │
    ├────────────────────────────────────┤
    │                                    │
    │ If user not in DB:                 │
    │ └─ CREATE user record:             │
    │    • email                         │
    │    • name                          │
    │    • role (from Graph groups)      │
    │    • managerId (from Graph)        │
    │    • entraId (oid)                 │
    │    • department (from org)         │
    │                                    │
    │ If user exists:                    │
    │ └─ UPDATE existing record:         │
    │    • Refresh manager & role        │
    │    • Sync org changes              │
    │                                    │
    └──────────────────┬─────────────────┘
                       │
                       ▼
    ┌────────────────────────────────────┐
    │ Create JWT Session Token           │
    ├────────────────────────────────────┤
    │                                    │
    │ JWT Payload:                       │
    │ ├─ userId                          │
    │ ├─ email                           │
    │ ├─ name                            │
    │ ├─ role (ADMIN/MANAGER/EMPLOYEE)   │
    │ ├─ department                      │
    │ ├─ exp (expiry: 7 days)            │
    │ ├─ iat (issued at)                 │
    │ └─ sign with secret                │
    │                                    │
    │ Store in HTTP-only cookie          │
    │ (secure, sameSite=strict)          │
    │                                    │
    └──────────────────┬─────────────────┘
                       │
                       ▼
    ┌────────────────────────────────────┐
    │ Redirect to Dashboard              │
    │ /dashboard/[role]                  │
    │ (role-aware routing)               │
    └────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ Option 2: Credentials (Development/Demo)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ User enters Email + Password                                               │
│     │                                                                       │
│     ▼                                                                       │
│ Validate in DB:                                                            │
│ ├─ Find user by email                                                      │
│ ├─ Compare passwords (bcrypt)                                              │
│ └─ On match: Create JWT (same as above)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ Subsequent Requests (Authenticated)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Browser sends HTTP cookie (JWT)                                            │
│     │                                                                       │
│     ▼                                                                       │
│ Server Action or Page Component calls:                                     │
│ const session = await auth()                                               │
│     │                                                                       │
│     ├─ Verify JWT signature                                                │
│     ├─ Check expiry                                                        │
│     └─ Return user object                                                  │
│                                                                             │
│ Available in Server Components & Actions:                                  │
│ session.user.userId                                                        │
│ session.user.role                                                          │
│ session.user.email                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Workflows

### Employee Goal Lifecycle

```
Start of Cycle (Jan 1)
         │
         ▼
┌─────────────────────────────────────┐
│ Admin Activates Goal Cycle (ACTIVE) │
│ - Sets goal-setting window open     │
│ - Syncs org from Entra ID           │
└─────────────────────────┬───────────┘
                          │
                          ▼
         ┌────────────────────────┐
         │ GOAL SETTING PHASE     │     Max 8 goals per cycle
         │ (Jan 1 - Jan 31)       │────→ Min 10% each
         │                        │     Total = 100%
         └────────────────────────┘
                          │
         ┌────────────────┴────────────┐
         │ Employee                     │
         ├────────────────┬────────────┤
         │  Creates       │  Edits     │
         │  Goals         │  Goals     │
         │   (DRAFT)      │  (DRAFT)   │
         └─────┬──────────┴─────┬──────┘
               │                │
               └─────┬──────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │ SUBMITS GOAL SHEET     │
         │ status: DRAFT → SUBMITTED
         │ • Validates all rules  │
         │ • Creates audit entry  │
         │ • Notifies manager     │
         └────────────────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │ MANAGER APPROVAL PHASE │
         │ (Jan 15 - Feb 15)      │
         │                        │
         │ Manager can:           │
         │ • APPROVE              │
         │ • RETURN w/ comment    │
         │ • EDIT goals           │
         └────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ APPROVED?            │ RETURNED?
         ▼                      ▼
    ┌────────────┐    ┌───────────────────┐
    │ APPROVED   │    │ RETURNED (DRAFT)  │
    │ isLocked:1 │    │ Employee edits    │
    │            │    │ Resubmits        │
    └────────────┘    └─────────┬─────────┘
         │                      │
         │◄─────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ GOAL LOCKED                │
    │ • No further edits         │
    │ • Admin unlock required    │
    │ • Achievement tracking     │
    │   opens per quarter        │
    └────────────┬───────────────┘
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    │            │            │            │            │
    ▼            ▼            ▼            ▼            ▼
 ┌────┐      ┌────┐      ┌────┐      ┌────┐      ┌──────┐
 │ Q1 │      │ Q2 │      │ Q3 │      │ Q4 │      │ FINAL│
 │    │      │    │      │    │      │    │      │SCORE │
 └──┬─┘      └──┬─┘      └──┬─┘      └──┬─┘      └──────┘
    │           │           │           │          ▲
    │ (Jan-Mar) │ (Apr-Jun) │ (Jul-Sep) │ (Oct-Dec)│
    │           │           │           │          │
    └─────────────────────────────────────────────┘


FOR EACH QUARTER:

Employee logs Achievement
    │
    ▼
┌──────────────────────────────────┐
│ Achievement Form (Q1-Q4)         │
│ ├─ Planned: X                    │
│ ├─ Actual: Y                     │
│ ├─ Status: NOT_STARTED / ON_TRACK│
│ │          / COMPLETED           │
│ └─ Completion Date               │
└──────────────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ AUTO-SCORE COMPUTED  │
        │                      │
        │ Based on UoM Type:   │
        │ • NUMERIC → actual/  │
        │   target * 100       │
        │ • PERCENTAGE → same  │
        │ • TIMELINE → date    │
        │   comparison         │
        │ • ZERO → 0 or 100    │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Manager Check-in     │
        │ (optional comment)   │
        └──────────────────────┘
                   │
                   ▼
      QUARTERLY SCORE VISIBLE
      (weighted by goal weightage)


End of Q4:
         │
         ▼
    ┌─────────────────────────┐
    │ Annual Cycle Closes     │
    │ • Final scores locked   │
    │ • Reports generated     │
    │ • XLSX export available │
    └─────────────────────────┘
```

### Manager Approval Workflow

```
Manager Dashboard → "Pending Approvals" Tab

    │
    ▼
┌────────────────────────────────────────┐
│ List of direct reports' submitted      │
│ goal sheets (status: SUBMITTED)        │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ View   │  │ Edit   │  │ Return │
│ Goals  │  │ Inline │  │ w/ Note│
└────┬───┘  └───┬────┘  └───┬────┘
     │          │           │
     └──────────┼───────────┘
                │
                ▼
     ┌──────────────────────┐
     │ APPROVE BUTTON       │
     │ Triggers:            │
     │ • status → APPROVED  │
     │ • isLocked → true    │
     │ • Creates audit log  │
     │ • Notifies employee  │
     └──────────────────────┘
                │
                ▼
     ┌──────────────────────┐
     │ RETURN BUTTON        │
     │ Triggers:            │
     │ • status → RETURNED  │
     │ • reason comment     │
     │ • Notifies employee  │
     │ • Employee reedits   │
     └──────────────────────┘
                │
                ▼
     Goal locked → Achievement
     tracking phase begins
```

---

## Shared Goals Flow

```
Admin/Manager: "Push Shared Goal" Option

    │
    ▼
┌────────────────────────────────────────┐
│ Select Goal Template                   │
│ Select Multiple Recipients             │
└────────────────┬───────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ For Each Recipient:            │
    │ • Create goal copy             │
    │ • Link: sharedFromId → original│
    │ • status: APPROVED (locked)    │
    │ • Ask recipient to set         │
    │   weightage (0-100%)           │
    └────────────┬───────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ Recipient Receives:            │
    │ • Notification (email + Teams) │
    │ • "Adjust Weightage" form      │
    │ • Can set 0-100% (independent) │
    └────────────┬───────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ Owner Logs Achievement Q1-Q4:  │
    │ • Saves achievement on original│
    │ • Sync triggered:              │
    │   "syncSharedAchievements()"   │
    │ • All copies get same planned/ │
    │   actual values                │
    │ • But score = actual/target *  │
    │   (recipient's weightage%)     │
    └────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ Each Recipient's Dashboard:    │
    │ • Shows copied goal            │
    │ • Shows shared achievements    │
    │ • Independent score (weighted) │
    │ • Contributes to their total   │
    │   annual score                 │
    └────────────────────────────────┘
```

---

## Escalation Flow

```
Vercel Cron Job Trigger (daily 08:00 UTC)

    │
    ▼ POST /api/admin/run-escalations
    │
    ├─ Iterate all active escalation rules
    │
    ├─ For each rule: evaluate condition
    │
    └─ Rule Conditions:
       ├─ "Goal not approved for > 5 days"
       ├─ "Goal on_track < 30% Q3"
       ├─ "Achievement not logged for Q2"
       └─ "User has pending approvals"
            │
            │ If matched:
            ▼
       ┌─────────────────────────────┐
       │ Create Escalation Record:   │
       │ • ruleId                    │
       │ • targetId (user)           │
       │ • status: OPEN              │
       │ • quarter                   │
       └──────────┬──────────────────┘
                  │
                  ▼
       ┌─────────────────────────────┐
       │ Send Notification:          │
       │ • Email (Resend)            │
       │ • Teams (Webhook)           │
       │ • In-app (DB record)        │
       │ • Deep link to action item  │
       └──────────┬──────────────────┘
                  │
                  ▼
       ┌─────────────────────────────┐
       │ User Can:                   │
       │ • Resolve (take action)     │
       │ • Dismiss (snooze)          │
       │ • Status → RESOLVED         │
       │ • resolvedAt timestamp      │
       └─────────────────────────────┘
```

---

## Scoring Engine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Achievement Score Calculation (scoring.ts)                │
└─────────────────────────────────────────────────────────────────────────────┘

Input: Goal + Achievement Record
    │
    ├─ uomType: NUMERIC | PERCENTAGE | TIMELINE | ZERO
    ├─ uomDirection: MIN | MAX
    ├─ target (goal amount)
    └─ actual (logged achievement)
         │
         ▼
    ┌─────────────────────────────┐
    │ SELECT SCORING FORMULA      │
    └────────┬────────────────────┘
             │
    ┌────────┴─────────┬────────────┬─────────────┐
    │                  │            │             │
    ▼                  ▼            ▼             ▼
┌──────────┐    ┌──────────┐  ┌─────────┐  ┌──────────┐
│ NUMERIC  │    │PERCENTAGE│  │ TIMELINE│  │  ZERO    │
└─────┬────┘    └────┬─────┘  └────┬────┘  └────┬─────┘
      │              │             │             │
      │              │             │             │
      ▼              ▼             ▼             ▼
    actual        actual=        Calc days   status=
    ─────── × 100 target × 100   between   COMPLETED?
    target        (when)         dates
      │              │             │          │
      ▼              ▼             ▼          ▼
    80 = 80%      85 = 85%    Calculate   YES: 100%
    100                       ratio of      NO: 0%
                              actual to
                              timeline

Example Outputs:
┌─────────────┬─────────┬──────────────────────────┐
│ UoM Type    │ Target  │ Actual → Score           │
├─────────────┼─────────┼──────────────────────────┤
│ NUMERIC     │ 100     │ 80 → 80%                 │
│ PERCENTAGE  │ 80%     │ 70% → 87.5% (70/80×100) │
│ TIMELINE    │ Sep 30  │ Sep 15 → 150% (early)   │
│ ZERO        │ N/A     │ Completed → 100%        │
│             │         │ Not Done → 0%            │
└─────────────┴─────────┴──────────────────────────┘

Cap Score:
├─ Max: 100% (over-achievement possible)
├─ Min: 0% (if target = 0, score = 0)
└─ Special case: uomDirection = MIN
   └─ If actual < target → higher score
      └─ score = target / actual × 100


Annual Score Calculation:

For Each Goal:
    Individual Score × Weightage %

Sum all goals:
    Total Score = Σ (Goal_Score × Weightage_%)

Example:
    Goal 1: Score 80% × 30% weightage = 24%
    Goal 2: Score 90% × 40% weightage = 36%
    Goal 3: Score 100% × 30% weightage = 30%
    ────────────────────────────────────────────
    Annual Score = 90%

Range: 0% - 100%+  (can exceed 100% if overachieved)
```

---

## Database Relationships

```
                          ┌─────────────────┐
                          │     User        │
                          ├─────────────────┤
                          │ id (PK)         │
                          │ email (UNIQUE)  │
                          │ name            │
                          │ role            │
                          │ managerId (FK)  │──┐
                          │ department      │  │ Self-referential
                          │ entraId         │  │ (hierarchy)
                          │ createdAt       │◄─┘
                          └────────┬─────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
          ┌──────────┐       ┌──────────┐      ┌──────────┐
          │  Goal    │       │Check-in  │      │Audit Log │
          ├──────────┤       ├──────────┤      ├──────────┤
          │id (PK)   │       │id (PK)   │      │id (PK)   │
          │userId(FK)├──────→│userId    │      │goalId(FK)│
          │cycleId(FK)       │managerId │      │userId    │
          │title     │       │employeeId       │action    │
          │status    │       │cycleId   │      │oldValue  │
          │weightage │       │quarter   │      │newValue  │
          │target    │       │comment   │      │createdAt │
          │uomType   │       │createdAt │      └──────────┘
          │...       │       └──────────┘
          └────┬─────┘
               │
          ┌────┴────┐
          │          │
          ▼          ▼
   ┌──────────┐  ┌──────────────┐
   │Achievement       │Shared Goal     │
   ├──────────┤  ├──────────────┤
   │id (PK)   │  │(part of Goal)│
   │goalId(FK)├──│sharedFromId  │
   │quarter   │  │(refs Goal)   │
   │planned   │  └──────────────┘
   │actual    │
   │score     │
   │status    │
   └──────────┘

                          ┌────────────────┐
                          │   GoalCycle    │
                          ├────────────────┤
                          │id (PK)         │
                          │name            │
                          │year            │
                          │status          │
                          │goalSettingOpen │
                          │goalSettingClose│
                          │q1Open/Close    │
                          │q2Open/Close    │
                          │q3Open/Close    │
                          │q4Open/Close    │
                          │forceOpenQ       │
                          └────────┬────────┘
                                   │
                                   ▼ (cycleId FK)
                            ┌──────────────┐
                            │    Goals     │
                            │Achievement   │
                            │Check-ins     │
                            └──────────────┘

    ┌─────────────────────┐  ┌──────────────────┐
    │ EscalationRule      │  │  Escalation      │
    ├─────────────────────┤  ├──────────────────┤
    │id (PK)              │  │id (PK)           │
    │name                 │  │ruleId (FK)       │
    │condition            │  │targetId (FK)     │
    │daysAfter           │  │quarter           │
    │level               │  │status            │
    │isActive            │  │resolvedAt        │
    └────────┬───────────┘  └──────────────────┘
             │                     │
             │ (if matched)        │
             └─────────────────────┘

    ┌──────────────────────────────┐
    │    Notification              │
    ├──────────────────────────────┤
    │id (PK)                       │
    │userId (FK) → User            │
    │type (APPROVAL | ACHIEVEMENT) │
    │title                         │
    │body                          │
    │href (deep link)              │
    │read (boolean)                │
    │createdAt                     │
    └──────────────────────────────┘
```

---

## Request Routing

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          ROOT LAYOUT (src/app/layout.tsx)                  │
│                        (Providers, metadata, styles)                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │            (auth) Layout (Unauthenticated Routes)                   │  │
│ ├──────────────────────────────────────────────────────────────────────┤  │
│ │  ├─ /login                → login/page.tsx                          │  │
│ │  └─ /unauthorized         → unauthorized/page.tsx                   │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │         (dashboard) Layout (Authenticated Routes + Sidebar)         │  │
│ ├──────────────────────────────────────────────────────────────────────┤  │
│ │ Sidebar (role-aware nav) | Topbar (notifications, user menu)        │  │
│ │                                                                      │  │
│ │ ┌──────────────────────────────────────────────────────────────┐   │  │
│ │ │          EMPLOYEE ROUTES                                    │   │  │
│ │ ├──────────────────────────────────────────────────────────────┤   │  │
│ │ │ /dashboard/employee/                                        │   │  │
│ │ │   ├─ page.tsx (goal list)                                   │   │  │
│ │ │   ├─ [goalId]/view (view goal + achievements Q1-Q4)         │   │  │
│ │ │   ├─ [goalId]/edit (edit goal form)                         │   │  │
│ │ │   ├─ shared-goals (adjust weightage on shared goals)        │   │  │
│ │ │   └─ profile (view profile)                                 │   │  │
│ │ └──────────────────────────────────────────────────────────────┘   │  │
│ │                                                                      │  │
│ │ ┌──────────────────────────────────────────────────────────────┐   │  │
│ │ │          MANAGER ROUTES                                     │   │  │
│ │ ├──────────────────────────────────────────────────────────────┤   │  │
│ │ │ /dashboard/manager/                                         │   │  │
│ │ │   ├─ page.tsx (pending approvals)                           │   │  │
│ │ │   ├─ approvals (goal review table)                          │   │  │
│ │ │   ├─ [employeeId]/view (employee goal sheet)               │   │  │
│ │ │   ├─ analytics (team analytics, trends, heatmap)          │   │  │
│ │ │   ├─ check-ins (Q1-Q4 comments)                            │   │  │
│ │ │   ├─ escalations (escalation management)                   │   │  │
│ │ │   └─ reports (team reports, export XLSX)                  │   │  │
│ │ └──────────────────────────────────────────────────────────────┘   │  │
│ │                                                                      │  │
│ │ ┌──────────────────────────────────────────────────────────────┐   │  │
│ │ │           ADMIN ROUTES                                      │   │  │
│ │ ├──────────────────────────────────────────────────────────────┤   │  │
│ │ │ /dashboard/admin/                                           │   │  │
│ │ │   ├─ page.tsx (admin dashboard overview)                    │   │  │
│ │ │   ├─ users (user management table)                          │   │  │
│ │ │   ├─ cycles (goal cycle management)                         │   │  │
│ │ │   ├─ escalations (escalation rules)                         │   │  │
│ │ │   ├─ push-goal (push shared goals to employees)             │   │  │
│ │ │   ├─ audit-log (full audit trail)                           │   │  │
│ │ │   ├─ unlock-goal (admin unlock locked goals)                │   │  │
│ │ │   └─ reports (system-wide reports)                          │   │  │
│ │ └──────────────────────────────────────────────────────────────┘   │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │                       API ROUTES                                     │  │
│ ├──────────────────────────────────────────────────────────────────────┤  │
│ │ /api/auth/[...nextauth]        → NextAuth callbacks                  │  │
│ │ /api/reports/export             → XLSX achievement export            │  │
│ │ /api/admin/run-escalations      → Cron job (escalation eval)        │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Trees

### Goal Submission Decision Tree

```
                    Employee submits goal sheet
                            │
                            ▼
                ┌────────────────────────────┐
                │ Validation Checks:         │
                └────────────┬───────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
        Count ≤ 8?    Weightage=100%?   Window open?
            │              │                │
        ┌───┴───┐      ┌────┴────┐      ┌───┴───┐
        │       │      │         │      │       │
       YES     NO     YES       NO     YES      NO
        │       │      │         │      │       │
        │       │      │         │      │       │
        └───┬───┘      └────┬────┘      └───┬───┘
            │               │               │
            ├───────────────┼───────────────┤
            │               │               │
            ▼               ▼               ▼
          PASS            FAIL (Error)    FAIL (Error)
            │
            ▼
    ┌────────────────────┐
    │ Update goal status:│
    │ DRAFT → SUBMITTED  │
    │ Lock submitted     │
    └────────────────────┘
            │
            ▼
    ┌────────────────────────────────┐
    │ Create audit log entry         │
    │ Notify manager (email + Teams) │
    └────────────────────────────────┘
            │
            ▼
    Return success response
```

### Achievement Logging Decision Tree

```
                Employee logs achievement
                        │
                        ▼
            ┌─────────────────────────┐
            │ Validation:             │
            │ • Quarter window open?  │
            │ • Goal exists?          │
            │ • User authorized?      │
            └────────────┬────────────┘
                         │
                    ┌────┴────┐
                    │         │
                   PASS      FAIL
                    │         │
                    │         ▼
                    │    Error response
                    │
                    ▼
            ┌─────────────────────────┐
            │ Calculate Score:        │
            │ (scoring.ts formula)    │
            └────────────┬────────────┘
                         │
                         ▼
            ┌─────────────────────────────┐
            │ Save Achievement Record:    │
            │ • planned                   │
            │ • actual                    │
            │ • score (auto-computed)     │
            │ • status                    │
            │ • quarter                   │
            └────────────┬────────────────┘
                         │
                         ▼
            ┌─────────────────────────────┐
            │ If SHARED GOAL:             │
            │ • Sync to all copies        │
            │ • Each copy computes own    │
            │   weighted score            │
            └────────────┬────────────────┘
                         │
                         ▼
            ┌─────────────────────────────┐
            │ Create notification:        │
            │ • Notify manager            │
            │ • "Achievement logged"      │
            └─────────────────────────────┘
                         │
                         ▼
            Return success + score
```

---

## Component Composition

```
┌────────────────────────────────────────────────────────────────────────────┐
│ DashboardLayout (Server Component)                                         │
│                                                                            │
│  ├─ Sidebar (role-aware, Server Component)                                │
│  │  ├─ Nav items based on session.user.role                               │
│  │  └─ Links to role-specific pages                                       │
│  │                                                                         │
│  ├─ Topbar (Client Component)                                             │
│  │  ├─ Notification Bell                                                  │
│  │  │  └─ useQuery hook to poll notifications                            │
│  │  ├─ User Menu (dropdown)                                               │
│  │  │  └─ Profile, Logout                                                 │
│  │  └─ Theme Toggle                                                       │
│  │                                                                         │
│  └─ Main Content Area (children from router)                              │
│     │                                                                      │
│     └─ Example: Employee Dashboard Page                                   │
│        (Server Component)                                                 │
│        │                                                                  │
│        ├─ Fetch direct from Prisma:                                      │
│        │  const goals = await prisma.goal.findMany({...})                │
│        │                                                                  │
│        ├─ Pass to child Client Components:                                │
│        │  <GoalsList goals={goals} />                                     │
│        │                                                                  │
│        │  ┌────────────────────────────────────────┐                     │
│        │  │ GoalsList (Client Component)           │                     │
│        │  ├────────────────────────────────────────┤                     │
│        │  │ Renders each goal:                     │                     │
│        │  │  <GoalCard goal={goal} />              │                     │
│        │  │                                        │                     │
│        │  │  ┌──────────────────────────────────┐ │                     │
│        │  │  │ GoalCard (Client Component)      │ │                     │
│        │  │  ├──────────────────────────────────┤ │                     │
│        │  │  │ Displays goal info               │ │                     │
│        │  │  │  • Title, weightage              │ │                     │
│        │  │  │  • Score badge                   │ │                     │
│        │  │  │  • Status                        │ │                     │
│        │  │  │  • Action buttons:               │ │                     │
│        │  │  │   [Edit] [View Details]          │ │                     │
│        │  │  │                                  │ │                     │
│        │  │  │ On click [View Details]:         │ │                     │
│        │  │  │  Navigate to goal detail page    │ │                     │
│        │  │  │                                  │ │                     │
│        │  │  │  ┌────────────────────────────┐ │ │                     │
│        │  │  │  │ GoalDetail Page            │ │ │                     │
│        │  │  │  │ (Server Component)         │ │ │                     │
│        │  │  │  ├────────────────────────────┤ │ │                     │
│        │  │  │  │ Fetch goal + achievements │ │ │                     │
│        │  │  │  │ Pass to AchievementTabs   │ │ │                     │
│        │  │  │  │                            │ │ │                     │
│        │  │  │  │ ┌──────────────────────┐  │ │ │                     │
│        │  │  │  │ │ AchievementTabs      │  │ │ │                     │
│        │  │  │  │ │ (Client Component)   │  │ │ │                     │
│        │  │  │  │ ├──────────────────────┤  │ │ │                     │
│        │  │  │  │ │ Q1 │ Q2 │ Q3 │ Q4   │  │ │ │                     │
│        │  │  │  │ │ Tabs → form to log   │  │ │ │                     │
│        │  │  │  │ │ achievement          │  │ │ │                     │
│        │  │  │  │ │                      │  │ │ │                     │
│        │  │  │  │ │ On submit:           │  │ │ │                     │
│        │  │  │  │ │ Call Server Action   │  │ │ │                     │
│        │  │  │  │ │ saveAchievement()    │  │ │ │                     │
│        │  │  │  │ └──────────────────────┘  │ │ │                     │
│        │  │  │  └────────────────────────────┘ │ │                     │
│        │  │  └──────────────────────────────────┘ │                     │
│        │  └────────────────────────────────────────┘                     │
│        │                                                                  │
│        └─ Floating action button:                                        │
│           [+ New Goal] → GoalFormDialog                                   │
│           ┌──────────────────────────┐                                    │
│           │ GoalFormDialog           │                                    │
│           │ (Client Component)       │                                    │
│           ├──────────────────────────┤                                    │
│           │ Modal with form fields:  │                                    │
│           │ • Title                  │                                    │
│           │ • Description            │                                    │
│           │ • Weightage (%)          │                                    │
│           │ • UoM Type               │                                    │
│           │ • Target                 │                                    │
│           │ • Deadline               │                                    │
│           │                          │                                    │
│           │ Validation:              │                                    │
│           │ • Zod schema on client   │                                    │
│           │ • Server-side revalidate │                                    │
│           │                          │                                    │
│           │ On submit:               │                                    │
│           │ → useTransition()        │                                    │
│           │ → createGoal()           │                                    │
│           │ → Toast notification     │                                    │
│           │ → Dialog close           │                                    │
│           │ → List refresh           │                                    │
│           └──────────────────────────┘                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16.2.6 (App Router), React 19.2, TypeScript 5, Tailwind CSS v4 |
| **UI Components** | Base UI + shadcn/ui v4, Lucide React icons |
| **Backend** | Next.js Server Actions (mutations), API Routes |
| **Database** | PostgreSQL (Neon serverless) |
| **ORM** | Prisma 7.8 |
| **Auth** | NextAuth.js v5 (JWT + Credentials + Azure AD SSO) |
| **Charts/Analytics** | Recharts |
| **Validation** | Zod |
| **External Services** | Microsoft Graph API (org hierarchy, role assignment), Azure Entra ID, Resend (email), Microsoft Teams Webhooks |
| **Export** | XLSX (xlsx library) |
| **Deployment** | Vercel (with Cron jobs) |

---

## Key Features

✅ **Complete Goal Lifecycle Management** — Create, submit, approve, lock, track achievements Q1-Q4
✅ **Role-Based Access Control** — Employee, Manager, Admin with distinct workflows
✅ **Shared Goals** — Admin/Manager pushes KPIs; employees adjust weightage; auto-sync achievements
✅ **Intelligent Scoring** — Numeric, Percentage, Timeline, Zero UoM types with auto-calculation
✅ **Multi-Quarter Achievement Tracking** — Quarterly achievement logging with progress visualization
✅ **Manager Approvals** — Goal sheet review, inline editing, approval/return with comments
✅ **Check-ins** — Quarterly manager comments on employee progress
✅ **Escalation Management** — Rule-based escalations with daily cron evaluation
✅ **Comprehensive Audit Trail** — All post-lock changes tracked with user, timestamp, old/new values
✅ **Analytics & Reporting** — Completion heatmaps, trends, effectiveness, XLSX export
✅ **Enterprise Integration** — Azure Entra ID SSO, Microsoft Graph API, Teams notifications
✅ **Email & Teams Notifications** — Transactional emails + Adaptive Cards with deep links
✅ **Governance** — Admin unlock goals, sync org from Entra, user management

---

## Perfect Architecture Summary

This is a **production-ready, role-based SaaS** platform with:

- **Clean Layered Architecture** → Presentation, Business Logic, Data Access, Database, External Integrations
- **Proper Separation of Concerns** → Server Components for data fetching, Client Components for interactivity, Server Actions for mutations
- **Enterprise-Grade Security** → Azure AD SSO, JWT sessions, role-based authorization, audit logs
- **Scalability** → Serverless database (Neon), Vercel Edge deployment, connection pooling, query caching
- **Comprehensive Workflows** → Goal setting, approval, achievement tracking, escalations, shared goals
- **Advanced Features** → Dynamic scoring formulas, multi-quarter tracking, governance, integrations
- **User Experience** → Role-aware dashboards, real-time notifications, analytics, XLSX exports

🚀 **Enterprise-ready, production-grade GoalTrack system!**

---

## See also

- [README.md](./README.md) — run the project locally and deploy to Vercel
- [SUBMISSION_ARCHITECTURE.md](./SUBMISSION_ARCHITECTURE.md) — AtomQuest 1.0 requirement alignment and judge-facing summary
