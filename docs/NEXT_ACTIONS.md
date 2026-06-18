# NEXT ACTIONS — PURE COLLECTIONS

> Daily working document. Updated at the start and end of each session.
> For project-level status see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18

---

## Table of Contents

1. [Current Sprint](#1-current-sprint)
2. [In Progress](#2-in-progress)
3. [Next Up](#3-next-up)
4. [Blockers](#4-blockers)
5. [Recently Completed](#5-recently-completed)

---

## 1. Current Sprint

**Goal:** Stabilize Phase 3 — close known bugs, clean UX, prepare for first real-user test.

---

## 2. In Progress

- [ ] **Landing screen redesign** — two first-class import options: Excel upload and Rivhit API token entry. Currently in active UI work.

---

## 3. Next Up

Priority order:

1. **Fix customer contact carry-over bug**
   - Contacts occasionally do not survive report re-import in certain browser/session scenarios
   - Reproduce, identify root cause, fix and verify across both import modes (Excel + API)
   - See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #1

2. **Implement Net +30 overdue calculation**
   - `ageDays` currently counts from document date
   - Should count from document date + 30 days (Net 30 terms)
   - A document is "overdue" only after day 30; before that it is current
   - Affects: aging bands, KPI cards, row colors, Customer Panel badges
   - See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #2

3. **Clean Settings page**
   - Remove developer tool cards (Document.Details, Document.List, Document.Copy) from the production UI
   - Move to a hidden dev route (`/dev/settings`) or behind a flag
   - Keep: API token input, connection test, save button

4. **Validate communication flows**
   - End-to-end test: WhatsApp draft opens correctly with real customer data
   - End-to-end test: Email draft opens correctly in mail client
   - Verify activity log entries are written correctly after each open
   - Verify document selection is respected in message body

5. **Prepare WhatsApp Automation planning**
   - Define what "automation" means in this context (scheduled messages? bulk sends?)
   - Identify WhatsApp Business API requirements
   - Produce a one-page architecture proposal before writing any code

---

## 4. Blockers

None currently.

---

## 5. Recently Completed

- [x] Document selection for communication drafts (2026-06-17) — per-document checkboxes, default 30+d selected, WhatsApp/Email disabled when empty
- [x] Refined statuses — "הבטיח לשלם" → "ממתין לתשלום"; expected payment date field (2026-06-17)
- [x] Customer activity timeline (2026-06-17)
- [x] Customer collection status workflow (2026-06-17)
- [x] KPI card filters + customer contacts (2026-06-17)
- [x] Customer detail slide-over panel (2026-06-16)
- [x] Rivhit API sync — open documents + contact autofill (2026-06-17)
- [x] Rivhit API connection settings page (2026-06-16)
