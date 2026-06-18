# COMMERCIAL PLAN — PURE COLLECTIONS

> Business roadmap and revenue strategy.
> For product decisions see [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md).
> For current status see [MASTER_STATUS.md](./MASTER_STATUS.md).

Last Updated: 2026-06-18

---

## Table of Contents

1. [Why Collections Before DiveLoop](#1-why-collections-before-diveloop)
2. [Target Customer](#2-target-customer)
3. [Installation Model](#3-installation-model)
4. [Pricing Strategy](#4-pricing-strategy)
5. [Customer Acquisition](#5-customer-acquisition)
6. [Revenue Targets](#6-revenue-targets)
7. [Commercialization Phases](#7-commercialization-phases)
8. [Support Assumptions](#8-support-assumptions)
9. [Risk Factors](#9-risk-factors)

---

## 1. Why Collections Before DiveLoop

**Decision date:** Before 2026-06-16 (pre-dates this repo).

PURE COLLECTIONS was prioritized over DiveLoop until October 2026 for the following reasons:

1. **Shorter path to revenue.** Collections solves a concrete, painful problem (outstanding invoices) that business owners feel every month. The value is immediate and measurable.

2. **Clear target customer.** Any Israeli small business using Rivhit with open invoices is a potential customer. The addressable market is well-defined.

3. **Lower technical complexity.** Collections requires no infrastructure, no backend at launch, and no ML/AI. The entire product runs in the browser against a single API.

4. **DiveLoop requires a longer runway.** DiveLoop has a longer sales cycle and more technical dependencies. It is a better fit for a later stage when there is revenue to fund it.

**Commitment:** DiveLoop is paused, not cancelled. It resumes after Collections reaches its first revenue milestone or October 2026, whichever comes first.

---

## 2. Target Customer

**Primary:** Israeli small business owners (5–50 employees) who:
- Use Rivhit as their accounting system
- Have recurring B2B customers with open invoices
- Currently track collections manually (phone, Excel, WhatsApp messages)
- Are frustrated by the time spent on collections follow-up

**Secondary (future):** Bookkeepers or collection agents managing multiple businesses.

**Not targeted at launch:**
- Large enterprises with dedicated AR departments
- Businesses not using Rivhit (no data source without the API connector)

---

## 3. Installation Model

**At launch:** Vendor-managed installation.

- The vendor (Avi) installs the app on the customer's computer or sets up a hosted URL
- Customer receives a trained walkthrough (30–60 minutes)
- Customer is shown how to: enter their API token, sync data, update statuses, send follow-ups
- No self-service onboarding

**Rationale:** Direct installation reduces friction, builds trust, and provides an opportunity to gather feedback. It is not scalable but is appropriate for the first 5–15 customers.

**Future:** Self-serve onboarding and SaaS access when demand exceeds vendor capacity.

---

## 4. Pricing Strategy

**Model:** Monthly subscription, billed per business (not per user).

| Tier | Price | What's included |
|---|---|---|
| Standard | ₪200–₪300/month | Single business, unlimited users, all features |
| Premium | ₪350–₪500/month | Standard + priority support + WhatsApp automation (when available) |

**Pricing rationale:**
- ₪200/month is below the decision threshold for most small business owners
- The product saves 2–5 hours/month of manual collections work — ROI is immediate
- No freemium: the product requires setup effort; free users don't convert

**Annual option:** 2 months free (10× monthly price) for annual commitment. Improves cash flow and reduces churn.

**First customers:** May be offered a discounted "founder rate" of ₪150/month in exchange for feedback and referrals.

---

## 5. Customer Acquisition

**Phase 1 (0–5 customers):** Direct outreach to known contacts in the Rivhit user community.

- Personal network: accountants, business owners already known to Avi
- Rivhit user forums and Facebook groups
- Demo-driven: show the product working with their own data

**Phase 2 (5–20 customers):** Referral-driven growth.

- Existing customers refer others (discount incentive)
- Accountant partnerships: accountants who manage multiple Rivhit clients can refer the product
- Each accountant partnership can yield 3–10 customers

**Phase 3 (20+ customers):** Content and community.

- Hebrew-language content about collections best practices
- Targeted ads to Rivhit users
- Possible Rivhit marketplace listing if available

**Key assumption:** Each satisfied customer is likely to know 2–3 similar businesses. Word-of-mouth is the primary growth engine at this scale.

---

## 6. Revenue Targets

| Milestone | Target Date | MRR | Customers |
|---|---|---|---|
| First paying customer | Q3 2026 | ₪200–₪300 | 1 |
| Product-market fit signal | Q4 2026 | ₪2,000+ | 8–10 |
| Sustainable growth | Q2 2027 | ₪5,000–₪10,000 | 20–40 |
| DiveLoop resumption threshold | Q3 2027 or Oct 2026 | — | — |

**Revenue goal Year 1 (to June 2027):** ₪5,000–₪10,000 MRR.

These are conservative targets. The product can reach ₪5,000 MRR with 20 customers at ₪250/month average. That is achievable through direct outreach without paid advertising.

---

## 7. Commercialization Phases

### Phase A — Build (current)
- Complete core product: fix bugs, clean UX, validate communication flows
- Target: product is ready for real-user testing
- Deliverable: stable build, no critical bugs, clean onboarding flow

### Phase B — First customers (Q3 2026)
- Install for 2–3 pilot customers at no cost or discounted rate
- Gather feedback over 4 weeks
- Fix top 3 reported issues
- Deliverable: 1–2 paying customers

### Phase C — Revenue (Q4 2026)
- Convert pilots to paying subscribers
- Begin active outreach for Phase 2 acquisition
- Deliverable: ₪2,000+ MRR

### Phase D — Scale (2027)
- Self-serve onboarding
- Accountant channel
- WhatsApp automation feature (differentiator)
- Deliverable: ₪5,000+ MRR

---

## 8. Support Assumptions

- **Response time:** Same-day for paying customers
- **Channel:** WhatsApp (primary), phone (for onboarding)
- **Vendor time budget:** ~2 hours/customer/month at 10 customers; must drop below 30 min/customer/month for the model to be sustainable at 20+ customers
- **Self-help:** FAQ document and short video walkthrough (to be created after first 3 customer installs reveal the most common questions)

---

## 9. Risk Factors

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rivhit API changes break sync | Medium | High | Monitor Rivhit changelog; Excel import as fallback |
| Target customers unwilling to pay ₪200/month | Low | High | Validate with direct conversations before building more |
| Support load exceeds capacity | Medium | Medium | Prioritize self-help content; raise prices to reduce customer count at same MRR |
| DiveLoop opportunity cost | Low | Medium | Oct 2026 hard deadline to reassess priorities |
| Competition from Rivhit native features | Low | High | Monitor Rivhit roadmap; differentiate on WhatsApp automation |
