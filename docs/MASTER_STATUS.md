# MASTER STATUS — PURE COLLECTIONS

> **This document is the authoritative source of truth for the project.**
> Update it whenever a feature ships, a decision is made, or priorities change.
> Last Updated: 2026-06-18

---

## How To Use This File

This file is the **primary source of truth** for PURE COLLECTIONS. Before asking Claude or any collaborator "what is the current status of X," check this file first.

| Rule | Detail |
|---|---|
| **Start here** | Any project status review — product, technical, commercial — begins with this file. |
| **Keep it current** | Update this file whenever a feature ships, a bug is confirmed, a decision is made, or priorities change. Do not let it drift. |
| **Major decisions belong here** | Product decisions, architecture choices, business rules, roadmap changes — all must be reflected in this file and in the relevant linked document. |
| **Short-term work goes elsewhere** | Day-to-day tasks, sprint items, and in-progress work belong in [NEXT_ACTIONS.md](./NEXT_ACTIONS.md), not here. |
| **Long-term state lives here** | This file tracks what the project *is*, not what is happening *today*. |

**Linked documents:**
- [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) — current sprint, in-progress work, immediate next steps
- [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md) — permanent record of product and architecture decisions
- [COMMERCIAL_PLAN.md](./COMMERCIAL_PLAN.md) — business model, pricing, revenue targets
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — open bugs and unresolved items

---

## Table of Contents

1. [Project Mission](#1-project-mission)
2. [Strategic Priorities](#2-strategic-priorities)
3. [Current Product Status](#3-current-product-status)
4. [Working Features](#4-working-features)
5. [Open Bugs](#5-open-bugs)
6. [Business Rules & Calculation Decisions](#6-business-rules--calculation-decisions)
7. [Roadmap](#7-roadmap)
8. [Cloud & Security Decisions](#8-cloud--security-decisions)
9. [Commercialization & Pricing](#9-commercialization--pricing)
10. [Support Model](#10-support-model)
11. [Future Integrations](#11-future-integrations)
12. [Last Known Good Commit](#12-last-known-good-commit)
13. [Immediate Next Actions](#13-immediate-next-actions)

---

## 1. Project Mission

PURE COLLECTIONS is a focused debt-collection management tool for small Israeli businesses using Rivhit (ריווחית) as their accounting system.

It lets a business owner or collections manager:
- See all open invoices grouped by customer
- Track collection status and communication history per customer
- Draft WhatsApp and email follow-ups from within the app
- Sync data directly from Rivhit via API or upload an Excel export

The product is intentionally minimal, purpose-built, and vendor-controlled. It is not a CRM. It is not a general accounting tool.

---

## 2. Strategic Priorities

**Until October 2026:** PURE COLLECTIONS is the primary commercial focus.
DiveLoop (the other project) is paused until Collections reaches paying customers.

See [COMMERCIAL_PLAN.md](./COMMERCIAL_PLAN.md) for the full business rationale.

Current priority order:
1. Fix contact carry-over bug (blocks trust in the product)
2. Implement Net +30 overdue calculation (core business rule)
3. Validate and clean communication flows
4. Prepare WhatsApp automation planning
5. Clean Settings page

---

## 3. Current Product Status

| Dimension | Status |
|---|---|
| Phase | Phase 3 — Core UI & Layout (active) |
| Build | Clean (`npm run build` — all pages static) |
| Lint | Clean (`npm run lint` — zero warnings) |
| Data import | Working — Excel + Rivhit API |
| Customer management | Working |
| Communication drafts | Working |
| Cloud deployment | Not started |
| Paying customers | 0 |

---

## 4. Working Features

### Data Import
- **Excel upload** — parse Rivhit `.xlsx` export; header at row 8; 9 columns confirmed; data-row filter on col[7] being numeric; handles 492-row files with credit notes
- **Rivhit API sync** — `Customer.OpenDocuments` endpoint; auto-fills contacts from `Customer.List` (fill-blanks-only); token stored in localStorage (`pure-collections:settings`)
- Both import modes: contacts, statuses, and activity log are **never overwritten** on import

### Workspace
- Full-screen table: שם לקוח, יתרה לתשלום, זמן חריגה, מסמך, מס׳ מסמך, תאריך מסמך
- Sort on all visible columns (click header → asc/desc)
- KPI summary cards (total, 60+d, 30–60d, row count) — click to filter by aging band
- Search filter — AND-logic with band filter and status filter
- localStorage persistence — survives page refresh; new import replaces data; cancel returns to saved workspace

### Customer Panel (slide-over)
- Opens on row click; closes on re-click or Escape
- 2×2 summary: total balance, open doc count, max overdue days, 60+ balance
- Document list sorted by `ageDays` descending; per-document aging badge
- Per-document checkboxes — default: 30+ day docs selected; fresh docs unselected
- WhatsApp / Email disabled when no documents selected

### Contacts
- Fields: contactPerson, phone, email, notes, updatedAt
- View + edit mode; auto-reset on customer switch
- Survive all report imports (`pure-collections:contacts` key)
- Auto-filled from Rivhit API (`Customer.List`) on sync — fill-blanks-only

### Collection Status
- Statuses: לא טופל / בטיפול / ממתין לתשלום / מועמד לתשלום / שולם
- Per-customer, persisted in `pure-collections:status`
- Expected payment date shown when status = "מועמד לתשלום"; hidden but preserved on status change
- Status filter chips in workspace; colored right-border per row

### Activity Timeline
- Types: status_changed, whatsapp_opened, email_opened, manual_note
- Per-customer log, newest-first; persisted in `pure-collections:activity`
- Auto-entries on status change and communication opens
- Manual note input in Customer Panel

### Communication Drafts
- WhatsApp: opens `wa.me` link with pre-built Hebrew message listing selected documents
- Email: opens `mailto:` link with subject + body
- Both log an activity entry on open
- Message built from selected documents only (no 10-doc cap)

### Settings Page
- API token input (password field with show/hide toggle)
- Connection test against `Document.TypeList` endpoint
- Developer tools: Document.Details, Document.List, Document.Copy test cards

---

## 5. Open Bugs

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for full details.

| # | Issue | Severity |
|---|---|---|
| 1 | Customer contact carry-over bug | High |
| 2 | Net +30 overdue calculation not implemented | Medium |

---

## 6. Business Rules & Calculation Decisions

### Overdue Calculation
- **Current behavior:** `ageDays` = days since document date (not due date)
- **Intended behavior:** Net +30 — a document is overdue after 30 days from document date
- **Decision pending:** confirm whether the 30-day window should be configurable per customer or fixed system-wide
- **Aging bands:** <30d = current, 30–60d = amber, 60+d = red

### Customer Grouping
- Customers are grouped by **exact name match** — no fuzzy matching, no automatic merging
- If a customer appears with two name variants in Rivhit, they will appear as two rows
- Manual merging is not supported; this is by design (see [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md))

### Document Type Filter
- Only document types 1, 2, 3 are imported via API: חשבונית מס, חשבונית מס קבלה, חשבונית מס זיכוי
- Type 8 (חשבון חיוב) and others are excluded
- This filter is vendor-controlled and not exposed to end users

### Contact Sync
- API sync fills blank phone/email fields only — never overwrites existing data
- Contact data is preserved across all import operations

---

## 7. Roadmap

### Active (Phase 3 — Core UI & Layout)
- [ ] Fix customer contact carry-over bug
- [ ] Implement Net +30 overdue calculation
- [ ] Validate and clean WhatsApp / email communication flow
- [ ] Redesign landing/import screen (two first-class options)
- [ ] Clean Settings page (remove developer tools section from production UI)

### Next (Phase 4 — Business Logic & Data)
- [ ] WhatsApp automation planning and architecture
- [ ] Bulk status update
- [ ] Export / print view
- [ ] Overdue summary report

### Later (Phase 5 — Launch)
- [ ] Cloud deployment (Vercel or equivalent)
- [ ] Multi-user / multi-business support
- [ ] Per-customer isolated data storage
- [ ] Rivhit webhook integration (if available)
- [ ] Coda / Hashavshevet connector architecture

---

## 8. Cloud & Security Decisions

- **Current storage:** `localStorage` only — all data is browser-local, per device
- **No backend database** at this stage
- **Token security:** API token stored in `localStorage` — acceptable for single-user local tool; must be reconsidered before multi-user cloud deployment
- **Cloud isolation requirement:** when moving to cloud, each business must have fully isolated data — no shared tables, no shared storage keys
- **No authentication layer** currently — not needed for local single-user use
- **HTTPS required** before any cloud deployment

---

## 9. Commercialization & Pricing

See [COMMERCIAL_PLAN.md](./COMMERCIAL_PLAN.md) for full detail.

| Parameter | Value |
|---|---|
| Installation model | Vendor-installed, per business |
| Pricing | Monthly subscription |
| Target price | ₪200–₪400/month per business |
| Revenue target (Year 1) | ₪5,000–₪10,000 MRR |
| First customer target | Q3 2026 |

---

## 10. Support Model

- Vendor-managed installation and updates
- No self-service onboarding at launch
- Direct support via WhatsApp or phone
- Business owner is primary contact and operator

---

## 11. Future Integrations

| System | Status | Notes |
|---|---|---|
| Rivhit API | Active — partial | OpenDocuments + CustomerList implemented; invoice link research in progress |
| Coda | Planned | Data export / reporting layer |
| Hashavshevet | Planned | Alternative accounting system connector |
| WhatsApp Business API | Planned | Automation layer — architecture not started |

---

## 12. Last Known Good Commit

| Field | Value |
|---|---|
| Hash | `3ee4533` |
| Message | WIP: add Rivhit contact autofill and communication messages |
| Date | 2026-06-17 |
| Build | Clean |
| Lint | Clean |

---

## 13. Immediate Next Actions

1. **Fix contact carry-over bug** — contacts not persisting correctly across report imports in some scenarios
2. **Implement Net +30 overdue calculation** — update `ageDays` logic to use due date = documentDate + 30d
3. **Landing screen redesign** — two first-class import options (Excel upload and Rivhit API token)
4. **Validate communication flows** — test WhatsApp and email drafts end-to-end with real data
5. **Plan WhatsApp automation** — define architecture before implementation

Cross-reference: [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)
