# PRD — PhysioSchedule (Appointments Management System)

## Original Problem Statement
Change the login method to use the employee number instead of the previous method. Logins must be created by an admin.
- Admin account: emp `26754` / password `Hemas@123`
- Admin can add/edit/remove staff members (user chose: full CRUD + roles/permissions)
- Seed staff (all default password `Hemas@123`): Ms Madhuwanthi 19352, Ms Binudi 27527, Ms Bawani 28262, Ms Prashanji L2562, Ms Sandini L2386, Ms Lakshi 23824, Ms Methni L2497, Ms Manthi L2020
- App purpose: appointments management (physiotherapy clinic)

## Architecture (IMPORTANT — non-standard stack)
- Lovable-exported project: **Vite + TanStack Start + React 19 + Supabase** (NO FastAPI/Mongo backend)
- App source lives at `/app/src` (routes, store, context); Supabase migrations in `/app/supabase/migrations`
- Supabase project: `gqfiumavcxiuonwgjxyj` (user's own project; config in `/app/.env`)
- Supervisor shims: `/app/frontend/package.json` start script runs `vite dev --host 0.0.0.0 --port 3000` from `/app`; `/app/backend/server.py` is a minimal FastAPI stub (unused, keeps supervisor happy)
- `vite.config.ts` has `server.allowedHosts: true` for the preview proxy
- Install deps with `yarn install --ignore-engines` (supabase-js wants node>=22, env has node 20)
- Auth: Supabase email/password, employee number mapped to `<emp>@staff.local` (see `src/context/auth-context.tsx`)
- Roles: `user_roles` table (admin/therapist/patient) + RLS policies; admin RPCs: `admin_list_staff`, `admin_create_staff`, `admin_delete_staff`
- Full DB setup script: `/app/public/setup.sql` (idempotent; user runs it in Supabase SQL Editor — agent has NO direct DB access, only anon key)

## Implemented (2026-06 / Jul 7 session)
- [x] Employee-number login UI + auth context (pre-existing from Lovable)
- [x] Admin staff page: list/add/remove staff (pre-existing)
- [x] FIXED: app previously pointed to inaccessible Lovable-managed Supabase project (`guyiacoembyrjsezwcuu`) whose seeded users crashed GoTrue (NULL token columns in auth.users → 500 "Database error querying schema")
- [x] Repointed app to user's own Supabase project + generated consolidated setup.sql (schema, RLS, realtime, seeds with correct auth.users inserts, admin RPCs)
- [x] Seeded admin 26754 + 8 staff, all logins verified via curl (9/9 LOGIN OK) and browser E2E (admin login → dashboard → staff page)
- [x] Preview environment fixed (frontend shim, vite allowedHosts, deps installed)

## Backlog
- P1: Edit staff details (name, employee number) from admin staff page — user requested edit capability
- P1: Admin password reset for staff (needs a new `admin_set_password` RPC in Supabase — user must run SQL to add it)
- P2: Role assignment UI (grant/revoke admin) — `admin_set_role` RPC already exists in DB
- P2: Clean up old Lovable migrations referencing the dead project (informational only)

## Key gotchas for future agents
- ANY new DB function/schema change must be given to the user as SQL to run in the Supabase SQL Editor (https://supabase.com/dashboard/project/gqfiumavcxiuonwgjxyj/sql/new) — no direct DB access from here. Host long scripts at /app/public/*.sql and share the preview URL.
- When creating users in auth.users via SQL, ALWAYS set token columns to '' (confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token) or GoTrue login breaks with 500.
- Restart frontend after changing /app/.env (Vite bakes env at startup).
