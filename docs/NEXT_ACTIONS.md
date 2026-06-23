# NEXT ACTIONS — PURE COLLECTIONS

> Daily working document. Updated at the start and end of each session.
> For project-level status see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-23 (docs synced to edb4fd2)

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

None currently.

---

## 3. Next Up

Priority order:

1. **Validate communication flows**
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

- [x] Business-days Today Follow-Up grace period (2026-06-22) — commit `edb4fd2`
- [x] Urgency-first default sort: red → yellow → fresh, balance within band (2026-06-22) — commit `151a034`
- [x] CustomerPanel default selection fix — all non-credit open docs selected by default (2026-06-22) — commit `701ce04`
- [x] Today Follow-Up filter chip in workspace (2026-06-22) — commit `43ebd48`
- [x] Per-document dispute status "במחלוקת" (2026-06-22) — commit `dfd5190`
- [x] KPI band alignment — band KPIs now sourced from actionable `tableRows` (2026-06-22) — commit `4ac65c7`
- [x] Credit invoice exclusion from collections work queue (2026-06-22) — commit `3c90168`
- [x] Landing screen redesign — two first-class import options (2026-06-18) — commit `bda31dc`
- [x] Clean Settings page — moved dev tools to `/dev` (2026-06-18) — commit `3c6b233`
- [x] Net +30 overdue calculation (BUG-002) (2026-06-18) — commit `725121a`
- [x] Fix customer contact carry-over bug (BUG-001) (2026-06-18) — commit `e003b2d`
- [x] Rivhit API sync — open documents + contact autofill (2026-06-17)
- [x] Document selection for communication drafts (2026-06-17)
- [x] Customer activity timeline (2026-06-17)
- [x] Customer collection status workflow (2026-06-17)
