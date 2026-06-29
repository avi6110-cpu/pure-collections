# CURRENT TASK

## Cloud Session 1 — Supabase Foundation — Complete

**Status:** Complete
**Completed:** 2026-06-29

---

## Objective

Establish the cloud database foundation before the clerk pilot begins. All operational data (statuses, contacts, activity) must no longer live only in localStorage.

## Deliverables

| Item | Result |
|------|--------|
| Supabase project created (eu-central-1) | Done ✓ |
| Auth configured (email/password, no confirm, 1h JWT) | Done ✓ |
| Three users created: Avi (owner), Ben (owner), Clerk (clerk) | Done ✓ |
| 7 tables created with full multi-tenant schema | Done ✓ |
| `tenants.features` column for future feature flags | Done ✓ |
| `tenants.outgoing_email` for business-level outgoing email | Done ✓ |
| 9 indexes created | Done ✓ |
| RLS enabled on all 7 tables | Done ✓ |
| 16 RLS policies created and verified | Done ✓ |
| `auth_tenant_id()` and `auth_user_role()` helper functions | Done ✓ |
| Vault functions: `upsert_rivhit_token`, `get_rivhit_token` | Done ✓ |
| Vault functions restricted to `service_role` only | Done ✓ |
| Tenant + 3 users seeded and verified | Done ✓ |
| Supabase CLI installed as dev dependency | Done ✓ |
| Baseline migration file committed to Git | Done ✓ |

## Files Changed

- `package.json` — added `supabase` dev dependency
- `supabase/config.toml` — Supabase CLI project config
- `supabase/.gitignore` — ignores local Supabase temp files
- `supabase/migrations/20260629000000_initial_schema.sql` — baseline schema migration

---

## Next Task

**Session 2 — Supabase Auth integration in Next.js**

See [`docs/daily/2026-06-29.md`](docs/daily/2026-06-29.md) → "Next Session" for the exact starting point and step-by-step plan.

Short version: install `@supabase/ssr`, create browser + server clients, add auth middleware, build login page, add auth callback route, create `.env.local` + `.env.example`. No database changes in Session 2.
