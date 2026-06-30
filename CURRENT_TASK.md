# CURRENT TASK

## Pilot Readiness — Multi-User Smoke Test

**Status:** Complete ✅
**Completed:** 2026-06-30

---

## Context

Sessions 2 and 3 are complete. The app now:
- Requires login (Supabase auth, middleware-protected routes)
- Stores the Rivhit API token in Supabase Vault (never in browser)
- Reads and writes contacts, statuses, and activity log to Supabase (cloud-first, localStorage fallback)
- Has a one-time bulk migration tool at `/settings` to push existing localStorage data to cloud

Three user accounts (Avi, Ben, Clerk) were created in Session 1 and are ready.

The only remaining gate before the clerk pilot is a live multi-user smoke test confirming that two users on the same tenant see each other's writes in real time.

---

## Smoke Test Plan

### Setup
- Avi logged in on Browser A
- Clerk logged in on Browser B (or a different device)
- Both see the same collections report (imported from the same data source)

### Tests to run

| # | Action | Expected |
|---|--------|----------|
| 1 | Clerk runs bulk migration at `/settings` | Existing localStorage data appears in Supabase |
| 2 | Avi sets a document status → Clerk refreshes | Clerk sees the updated status |
| 3 | Clerk saves a contact note → Avi refreshes | Avi sees the updated contact |
| 4 | Avi adds a manual activity note → Clerk refreshes | Clerk sees the activity entry |
| 5 | Avi saves a status → Clerk sets it to something different within seconds | Newer write wins; both users end up consistent after next refresh |
| 6 | Both users online simultaneously → one user changes status | Other user sees the change after their next load/refresh |

### Pass criteria
All 6 tests pass with no data loss, no duplicate entries, and no ioError banners on either device under normal conditions.

---

## Optional (low priority, can do post-pilot)

- Session 3.5 — sync log metadata: write to `sync_log` table on API sync
- Activity log pagination: time-windowed fetch if tenant accumulates large history

---

## Previous Tasks

| Task | Status | Completed |
|------|--------|-----------|
| Session 1 — Supabase Foundation | Complete | 2026-06-29 |
| Session 2 — Auth Integration + Rivhit Vault | Complete | 2026-06-29 |
| Session 3.1 — Customer Contacts cloud migration | Complete | 2026-06-29 |
| Session 3.2 — Document Statuses cloud migration | Complete | 2026-06-29 |
| Session 3.3 — Activity Log cloud migration | Complete | 2026-06-29 |
| Session 3.4 — Bulk migration tool | Complete | 2026-06-29 |
| Pilot Readiness QA — 15-test automated smoke suite | Complete | 2026-06-30 |
