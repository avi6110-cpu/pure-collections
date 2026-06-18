# PRODUCT DECISIONS — PURE COLLECTIONS

> Permanent record of important product decisions.
> Once recorded here, a decision should not be reversed without an explicit new entry.
> For current status see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18

---

## Table of Contents

1. [Customer Grouping — Exact Name Policy](#1-customer-grouping--exact-name-policy)
2. [No Automatic Customer Merging](#2-no-automatic-customer-merging)
3. [Manual Control Philosophy](#3-manual-control-philosophy)
4. [Contact Sync — Fill-Blanks-Only](#4-contact-sync--fill-blanks-only)
5. [Allowed Document Types](#5-allowed-document-types)
6. [Vendor-Controlled Critical Settings](#6-vendor-controlled-critical-settings)
7. [Data Persistence — Import Never Overwrites](#7-data-persistence--import-never-overwrites)
8. [Overdue Calculation — Net +30](#8-overdue-calculation--net-30)
9. [Communication — Draft-Only, No Sending](#9-communication--draft-only-no-sending)
10. [Future Cloud Isolation Requirements](#10-future-cloud-isolation-requirements)
11. [Business Support Approach](#11-business-support-approach)
12. [Future Connector Architecture](#12-future-connector-architecture)

---

## 1. Customer Grouping — Exact Name Policy

**Decision:** Customers are grouped by exact string match on `customerName`.

**Rationale:** Fuzzy matching introduces unpredictable merges. In a collections context, incorrectly merging two customers is a serious error (wrong balance, wrong contact). Exact matching is safe, auditable, and predictable.

**Consequence:** If Rivhit has the same customer under two name variants (e.g. "אלון בע״מ" vs. "אלון בע"מ"), they appear as two separate rows. The user must align the names in Rivhit, not in this tool.

**Status:** Permanent. Not revisitable without explicit user approval.

---

## 2. No Automatic Customer Merging

**Decision:** The app does not merge customer records automatically under any circumstances.

**Rationale:** Merging requires human judgment. The business owner knows whether "אלון" and "אלון ושות׳" are the same legal entity. The app does not.

**Consequence:** No merge button, no duplicate detection UI, no fuzzy grouping. This is intentional.

**Status:** Permanent.

---

## 3. Manual Control Philosophy

**Decision:** The user remains in full control of all data modifications. The app assists but never decides.

This means:
- Status changes require an explicit click — no automatic transitions
- Contacts are never overwritten unless the user edits them manually or explicitly triggers a sync
- Import never resets statuses, contacts, or activity log
- Communication drafts are opened, not sent — the user sends from their own WhatsApp / mail client

**Status:** Permanent core principle.

---

## 4. Contact Sync — Fill-Blanks-Only

**Decision:** When syncing contacts from Rivhit `Customer.List`, only blank fields are filled. Existing data is never overwritten.

**Rationale:** The user may have corrected or enriched Rivhit data (e.g. added a direct mobile number that differs from the main business number). Overwriting that with Rivhit data would silently destroy accurate local data.

**Implementation:** In `AppShell.handleApiSync`, the merge loop checks `hasPhone` and `hasEmail` before writing. Only fills when the existing field is empty.

**Status:** Permanent. The only exception would be an explicit "force refresh contacts" user action, which does not exist yet.

---

## 5. Allowed Document Types

**Decision:** Only Rivhit document types 1, 2, and 3 are imported via API sync.

| Type # | Hebrew Name |
|---|---|
| 1 | חשבונית מס |
| 2 | חשבונית מס קבלה |
| 3 | חשבונית מס זיכוי |

**Excluded:** Type 8 (חשבון חיוב), delivery notes, quotes, and all other types.

**Rationale:** Only tax invoices represent enforceable payment obligations. Including delivery notes or quotes in a collections report would be incorrect and potentially misleading.

**Note:** The Excel import does not filter by document type — it imports all rows present in the export file. This is acceptable because the user controls which export they upload.

**Status:** The set `{1, 2, 3}` is defined in `src/lib/parseRivhitApi.ts → ALLOWED_DOC_TYPES`. Changing it requires explicit approval.

---

## 6. Vendor-Controlled Critical Settings

**Decision:** Certain settings are not exposed to end users and are controlled by the vendor (the developer / Avi).

These include:
- Allowed document types (`ALLOWED_DOC_TYPES`)
- Aging band thresholds (30d, 60d)
- API endpoint URLs
- Net +30 payment term (when implemented — may become configurable later, but starts as fixed)

**Rationale:** Exposing these settings to end users increases support burden and creates risk of misconfiguration that corrupts their collections view.

**Status:** Permanent for the initial product. May be revisited if large-enterprise customers require customization.

---

## 7. Data Persistence — Import Never Overwrites

**Decision:** A new import (either Excel or API) never overwrites:
- Customer contacts (`pure-collections:contacts`)
- Collection statuses (`pure-collections:status`)
- Activity log (`pure-collections:activity`)

It only replaces:
- The document/report data (`pure-collections:report`)

**Rationale:** The user builds up contact and status data over time. That data is their work product. Losing it on import would make the app unusable.

**Status:** Permanent. Any change to this behavior requires an explicit separate import mode labeled as destructive.

---

## 8. Overdue Calculation — Net +30

**Decision:** A document is considered overdue when it is more than 30 days past its document date (Net 30 payment terms).

- `ageDays` = days since document date
- Overdue threshold = 30 days
- Aging bands: <30d current (gray), 30–60d amber, 60+d red

**Status:** The threshold is currently NOT implemented. `ageDays` is calculated from document date without the 30-day offset. This is a known bug — see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) #2.

**Future consideration:** Allow configurable payment terms per customer (Net 15, Net 30, Net 60). Not in scope until the base case is working.

---

## 9. Communication — Draft-Only, No Sending

**Decision:** PURE COLLECTIONS never sends messages on behalf of the user. It only opens pre-filled drafts.

- WhatsApp: opens `wa.me/?text=...` in a new tab
- Email: opens `mailto:?subject=...&body=...` in the default mail client

**Rationale:** Sending messages on behalf of a business carries legal and reputational risk. The user must review and explicitly send each message.

**Status:** Permanent. WhatsApp Business API automation (planned) will be a separate explicit mode with clear user confirmation.

---

## 10. Future Cloud Isolation Requirements

**Decision:** When PURE COLLECTIONS moves to cloud/multi-tenant, each business must have fully isolated data.

Requirements for cloud architecture:
- No shared database tables across businesses
- No shared localStorage keys (already per-browser, but must be per-user-account in cloud)
- API tokens must be stored server-side per business, not in browser localStorage
- Authentication required before any data access

**Status:** Not implemented. Current architecture is single-user, browser-local. This decision is a forward constraint on the cloud design.

---

## 11. Business Support Approach

**Decision:** The product launches as a vendor-managed, white-glove installation.

- The vendor installs and configures the app for each customer
- No self-service onboarding at launch
- Support is via direct contact (WhatsApp / phone)
- This reduces customer support complexity and allows rapid iteration

**Rationale:** The target customer (small Israeli business owner using Rivhit) is unlikely to self-onboard a technical tool. Direct installation builds trust and reduces churn.

**Status:** Initial launch model. Will revisit if demand exceeds vendor capacity.

---

## 12. Future Connector Architecture

**Decision:** PURE COLLECTIONS is designed to support multiple data source connectors, not just Rivhit.

Planned connectors:
| System | Type | Status |
|---|---|---|
| Rivhit | Accounting / ERP | Partially implemented |
| Coda | Data layer / reporting | Planned |
| Hashavshevet | Accounting (alternative) | Planned |

**Architecture principle:** Each connector must implement a common interface that produces `RivhitRow[]` (or a successor type). The workspace layer should not know which connector was used.

**Current state:** The connector abstraction does not exist yet. `importSource: "api" | "excel"` is the only distinction today. When a third source is added, this must be refactored to a proper connector pattern.

**Status:** Architectural intent, not yet implemented.
