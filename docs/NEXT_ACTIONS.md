# NEXT ACTIONS — PURE COLLECTIONS

> Daily working document. Updated at the start and end of each session.
> For project-level status see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18 (BUG-001 + BUG-002 closed)

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

1. **Clean Settings page**
   - Remove developer tool cards (Document.Details, Document.List, Document.Copy) from the production UI
   - Move to a hidden dev route (`/dev/settings`) or behind a flag
   - Keep: API token input, connection test, save button

2. **Validate communication flows**
   - End-to-end test: WhatsApp draft opens correctly with real customer data
   - End-to-end test: Email draft opens correctly in mail client
   - Verify activity log entries are written correctly after each open
   - Verify document selection is respected in message body

3. **Prepare WhatsApp Automation planning**
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
- [x] Implement Net +30 overdue calculation — BUG-002 (2026-06-18) — commit `725121a`
- [x] Fix customer contact carry-over bug — BUG-001 (2026-06-18) — commit `e003b2d`
- [x] Rivhit API connection settings page (2026-06-16)
