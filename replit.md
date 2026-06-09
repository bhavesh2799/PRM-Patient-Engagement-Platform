# Hospital CRM & Patient Engagement Platform

A single-tenant, demo-mode CRM and patient engagement platform built for Affordplan targeting the Indian hospital market. Covers incoming leads (CRM inbox, CSV upload, web form), outbound campaigns (WhatsApp/SMS/Push), appointment booking, and a compliance-gated campaign approval flow.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `POST /api/hospital/reset` — force re-seed all demo data
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, port 8080, served at `/api`
- Frontend: React + Vite (Tailwind v4, shadcn/ui, Recharts, wouter), served at `/`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod` — NOT `zod/v4`, esbuild cannot resolve that subpath)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec, source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/` — Drizzle ORM schema files (one per domain)
- `artifacts/api-server/src/routes/` — Express route handlers (one file per domain)
- `artifacts/api-server/src/lib/seed.ts` — idempotent demo seed (25 leads, 5 doctors, 9 templates, 5 campaigns, wallet ₹12,450)
- `artifacts/hospital-crm/src/pages/` — all frontend pages organized by section
- `artifacts/hospital-crm/src/components/layout/` — Topbar, Sidebar, AppLayout

## Architecture decisions

- **Contract-first:** OpenAPI spec drives both backend validation (Zod schemas) and frontend data fetching (React Query hooks). Never write manual fetch calls.
- **Session role switcher:** `GET/PUT /api/session/role` stores the active demo role (`exec` | `manager` | `ap_admin`) in the `session_store` table. Super-admin nav only shows for `ap_admin`.
- **Idempotent seed:** Seed skips if the hospital row already exists. Use `POST /api/hospital/reset` to wipe and re-seed.
- **Compliance gate:** Campaign approve endpoint runs 6 ordered checks — DLT header match (SMS), Meta approval (WhatsApp), suppression scrub, frequency cap, wallet balance, and 09:00–21:00 IST send window. First two per channel are hard blocks.
- **Mock delivery:** `simulateDeliveryEvents()` in `lib/mockMessaging.ts` uses a setTimeout chain to simulate sent→delivered→read events after campaign launch.
- **Currency / timezone:** All amounts in ₹ INR formatted with `en-IN` locale. Send window enforced in IST (Asia/Kolkata).

## Product

- **Command Center** — unified KPI dashboard (leads, appointments, channel breakdown, 7-day trend)
- **CRM Inbox** — master-detail lead list with pick-up, status transitions, and WABA reply mock
- **CSV Upload** — bulk lead import with column mapping UI
- **Appointment Booking** — bookings table + doctor cards with Edit/Schedule actions
- **Marketing Campaigns** — draft → submitted → approved → live → completed lifecycle with compliance gate
- **Templates** — WhatsApp/SMS/Push template library with request-and-approve workflow
- **Audience Segments** — rule-based and manual segments with audience size estimates
- **Campaign Metrics** — per-campaign funnel drill-down
- **Wallet & Billing** — prepaid balance chip + transaction ledger, low-balance alert
- **Settings** — Send Rules (TRAI window, frequency cap), Integrations, Contact Variables, Team & Users, Profile
- **Super-Admin (ap_admin only)** — Channels, template approvals, campaign oversight
- **Public Form** — embeddable patient intake form at `/form`

## User preferences

- Currency: ₹ INR with `en-IN` locale
- Timezone: IST (Asia/Kolkata)
- Demo roles: exec (Front-office Exec), manager (Marketing Manager), ap_admin (Affordplan Admin)
- All integrations mocked — no real third-party API calls

## Gotchas

- Always use `import { z } from "zod"` NOT `"zod/v4"` — esbuild in api-server cannot resolve the subpath
- Express 5 wildcards use `/{*splat}` not bare `*`
- Never use `console.log` in server code — use `req.log` in route handlers, `logger` for non-request code
- `update` without WHERE: use `where(gt(table.id, 0))` pattern with Drizzle
- Seed is idempotent; `POST /api/hospital/reset` forces a full wipe + re-seed
- Dashboard API response shape: `totalLeads`, `newLeads`, `convertedLeads`, `leadsByChannel[]`, `funnel[]`, `trend[]`, `appointmentSummary{}`, `recentLeads[]` — NOT `revenueAttributed` or `conversionByChannel`
- Engagement dashboard returns: `patientsReachedMtd` (camelCase, lowercase 'd') NOT `patientsReachedMTD`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Run codegen after any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
