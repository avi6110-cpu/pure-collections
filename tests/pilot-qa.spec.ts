/**
 * Pilot Readiness QA — PURE COLLECTIONS
 * Run:  npx playwright test tests/pilot-qa.spec.ts
 *
 * Prerequisites:
 *  1. Dev server running on localhost:3000
 *  2. .env.local present with valid Supabase keys
 *  3. Credentials file at CRED_PATH (created by the test setup script)
 *
 * This file must NOT be committed while it contains test credential paths.
 * Delete or gitignore after QA is complete.
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient }                                  from "@supabase/supabase-js";
import { readFileSync, existsSync, unlinkSync }         from "fs";
import { join }                                          from "path";
import { randomUUID }                                    from "crypto";

// ── Paths ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, "..");
const ENV_PATH     = join(PROJECT_ROOT, ".env.local");
const CRED_PATH    = join(
  "C:\\Users\\User\\AppData\\Local\\Temp\\claude\\C--Users-User-OneDrive---Pure-Water-Israel---1-21274625------------------------PURE-COLLECTIONS\\ca2c525e-c484-4a60-a7e5-565df8d876bf\\scratchpad",
  "qa-creds.txt",
);

// ── Read environment ──────────────────────────────────────────────────────────

function readEnvVar(content: string, key: string): string {
  return content.match(new RegExp(`^${key}=(.+)`, "m"))?.[1]?.trim() ?? "";
}

const envContent          = readFileSync(ENV_PATH, "utf-8");
const SUPABASE_URL        = readEnvVar(envContent, "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SECRET_KEY = readEnvVar(envContent, "SUPABASE_SECRET_KEY");

// ── Credentials (loaded + wiped at test start) ────────────────────────────────

const BEN_EMAIL    = "benazulaygk1@gmail.com";
const CLERK_EMAIL  = "invoice@pureshop.co.il";
let BEN_PASSWORD   = "";
let CLERK_PASSWORD = "";

function loadAndDeleteCreds(): void {
  if (!existsSync(CRED_PATH)) {
    throw new Error(`Credentials file not found: ${CRED_PATH}`);
  }
  const raw = readFileSync(CRED_PATH, "utf-8");
  unlinkSync(CRED_PATH);                            // wipe immediately

  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === "BEN_PASSWORD")   BEN_PASSWORD   = v;
    if (k === "CLERK_PASSWORD") CLERK_PASSWORD = v;
  }

  if (!BEN_PASSWORD || !CLERK_PASSWORD) {
    throw new Error("Credentials file is incomplete — BEN_PASSWORD or CLERK_PASSWORD missing");
  }
}

// ── Supabase admin client (Node-side only, never in browser) ─────────────────

const adminDb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Stable test identifiers for this QA run ───────────────────────────────────

const QA_CUSTOMER   = "QA_SMOKE_TEST_CUSTOMER";
const QA_DOC_KEY    = `${QA_CUSTOMER}|חשבונית מס|9999`;
const QA_ENTRY_ID   = randomUUID();             // stable within this run
const QA_ENTRY_TEXT = `QA smoke test note — ${new Date().toISOString()}`;
const SEED_TS       = Date.now() + 999_999_999; // far future — always newer than cloud

// Payload matching the BulkMigratePayload interface expected by /api/migrate/bulk
const SEED_PAYLOAD = {
  contacts: {
    [QA_CUSTOMER]: {
      phone:     "0501234567",
      email:     "qa@test.local",
      updatedAt: SEED_TS,
    },
  },
  statuses: {
    [QA_DOC_KEY]: {
      status:    "בטיפול",
      updatedAt: SEED_TS,
    },
  },
  activity: {
    [QA_CUSTOMER]: [
      {
        id:        QA_ENTRY_ID,
        type:      "note",
        text:      QA_ENTRY_TEXT,
        createdAt: SEED_TS,
      },
    ],
  },
};

// ── Contexts ──────────────────────────────────────────────────────────────────

let benContext:   BrowserContext;
let clerkContext: BrowserContext;
let benPage:      Page;
let clerkPage:    Page;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill("#email",    email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15_000 });
}

async function seedLocalStorage(page: Page): Promise<void> {
  await page.evaluate((payload) => {
    localStorage.setItem("pure-collections:contacts", JSON.stringify(payload.contacts));
    localStorage.setItem("pure-collections:status",   JSON.stringify(payload.statuses));
    localStorage.setItem("pure-collections:activity", JSON.stringify(payload.activity));
  }, SEED_PAYLOAD);
}

async function triggerMigration(page: Page): Promise<void> {
  await page.goto("/settings");
  await seedLocalStorage(page);
  await page.reload();
  await page.waitForLoadState("networkidle");

  const btn = page.getByRole("button", { name: /סנכרן לענן|סנכרן שוב/ });
  await expect(btn).toBeEnabled({ timeout: 8_000 });
  await btn.click();

  await expect(
    page.locator("text=הסנכרון הושלם"),
  ).toBeVisible({ timeout: 25_000 });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Pilot Readiness QA", () => {

  test.beforeAll(async ({ browser }) => {
    // Load + immediately destroy credentials
    loadAndDeleteCreds();

    benContext   = await browser.newContext();
    clerkContext = await browser.newContext();
    benPage      = await benContext.newPage();
    clerkPage    = await clerkContext.newPage();
  });

  test.afterAll(async () => {
    // Clean up QA seed rows from DB (best-effort)
    await adminDb.from("customer_contacts").delete().eq("customer_name", QA_CUSTOMER);
    await adminDb.from("document_statuses").delete().eq("doc_status_key", QA_DOC_KEY);
    await adminDb.from("activity_log").delete().eq("id", QA_ENTRY_ID);

    await benContext.close();
    await clerkContext.close();
  });

  // ── T01 ───────────────────────────────────────────────────────────────────────
  test("T01 — server health: responds without 5xx", async () => {
    const resp = await benPage.request.get("/");
    expect(
      resp.status(),
      `Expected non-5xx, got ${resp.status()}`,
    ).toBeLessThan(500);
  });

  // ── T02 ───────────────────────────────────────────────────────────────────────
  test("T02 — unauthenticated / redirects to /login", async () => {
    await benPage.goto("/");
    await expect(benPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ── T03 ───────────────────────────────────────────────────────────────────────
  test("T03 — Ben (owner) can log in", async () => {
    await loginAs(benPage, BEN_EMAIL, BEN_PASSWORD);
    await expect(benPage).not.toHaveURL(/\/login/);

    // No error banner visible
    const errBanner = benPage.locator("div.bg-red-600");
    await expect(errBanner).not.toBeVisible();
  });

  // ── T04 ───────────────────────────────────────────────────────────────────────
  test("T04 — Clerk can log in", async () => {
    await loginAs(clerkPage, CLERK_EMAIL, CLERK_PASSWORD);
    await expect(clerkPage).not.toHaveURL(/\/login/);

    const errBanner = clerkPage.locator("div.bg-red-600");
    await expect(errBanner).not.toBeVisible();
  });

  // ── T05 ───────────────────────────────────────────────────────────────────────
  test("T05 — no ioError banners on main page load (Ben)", async () => {
    await benPage.goto("/");
    await benPage.waitForLoadState("networkidle");

    // ioError banner: fixed top div with bg-red-600
    const ioBanner = benPage.locator("div.bg-red-600");
    await expect(ioBanner).not.toBeVisible({ timeout: 8_000 });
  });

  // ── T06 ───────────────────────────────────────────────────────────────────────
  test("T06 — bulk migration: success banner appears", async () => {
    await triggerMigration(benPage);

    // No failure banner
    const failBanner = benPage.locator("text=הסנכרון נכשל");
    await expect(failBanner).not.toBeVisible();
  });

  // ── T07a ──────────────────────────────────────────────────────────────────────
  test("T07a — DB: contact row exists in Supabase", async () => {
    const { data, error } = await adminDb
      .from("customer_contacts")
      .select("customer_name, phone")
      .eq("customer_name", QA_CUSTOMER);

    expect(error, `Supabase error: ${error?.message}`).toBeNull();
    expect(data?.length, "Expected 1 contact row").toBeGreaterThan(0);
    expect(data?.[0]?.phone).toBe("0501234567");
  });

  // ── T07b ──────────────────────────────────────────────────────────────────────
  test("T07b — DB: status row exists in Supabase", async () => {
    const { data, error } = await adminDb
      .from("document_statuses")
      .select("doc_status_key, status")
      .eq("doc_status_key", QA_DOC_KEY);

    expect(error, `Supabase error: ${error?.message}`).toBeNull();
    expect(data?.length, "Expected 1 status row").toBeGreaterThan(0);
    expect(data?.[0]?.status).toBe("בטיפול");
  });

  // ── T07c ──────────────────────────────────────────────────────────────────────
  test("T07c — DB: activity entry exists in Supabase", async () => {
    const { data, error } = await adminDb
      .from("activity_log")
      .select("id, text")
      .eq("id", QA_ENTRY_ID);

    expect(error, `Supabase error: ${error?.message}`).toBeNull();
    expect(data?.length, "Expected 1 activity row").toBeGreaterThan(0);
    expect(data?.[0]?.text).toBe(QA_ENTRY_TEXT);
  });

  // ── T08 ───────────────────────────────────────────────────────────────────────
  test("T08 — no duplicate entries after second migration run", async () => {
    // Run migration a second time with the IDENTICAL seed payload
    await triggerMigration(benPage);

    // Contact: still exactly 1 row (upsert on conflict)
    const { data: contacts } = await adminDb
      .from("customer_contacts")
      .select("customer_name")
      .eq("customer_name", QA_CUSTOMER);
    expect(contacts?.length, "Contact count should still be 1").toBe(1);

    // Status: still exactly 1 row
    const { data: statuses } = await adminDb
      .from("document_statuses")
      .select("doc_status_key")
      .eq("doc_status_key", QA_DOC_KEY);
    expect(statuses?.length, "Status count should still be 1").toBe(1);

    // Activity: still exactly 1 row (ON CONFLICT id DO NOTHING)
    const { data: activity } = await adminDb
      .from("activity_log")
      .select("id")
      .eq("id", QA_ENTRY_ID);
    expect(activity?.length, "Activity count should still be 1").toBe(1);
  });

  // ── T09 ───────────────────────────────────────────────────────────────────────
  test("T09 — status sync: Clerk's browser receives Supabase statuses", async () => {
    // Clerk navigates to /; AppShell calls fetchCloudStatuses() which hits Supabase REST.
    // Intercept the response — if it succeeds, Clerk can see the shared tenant data.
    const statusRespPromise = clerkPage.waitForResponse(
      (resp) =>
        resp.url().includes("supabase.co") &&
        resp.url().includes("document_statuses"),
      { timeout: 15_000 },
    );

    await clerkPage.goto("/");
    const resp = await statusRespPromise;

    expect(resp.status(), "Supabase statuses request should succeed").toBe(200);

    const body = (await resp.json()) as Array<{ doc_status_key: string }>;
    const found = body.some((row) => row.doc_status_key === QA_DOC_KEY);
    expect(found, `Clerk should see QA status key: ${QA_DOC_KEY}`).toBe(true);
  });

  // ── T10 ───────────────────────────────────────────────────────────────────────
  test("T10 — contact sync: Clerk's browser receives Supabase contacts", async () => {
    const contactRespPromise = clerkPage.waitForResponse(
      (resp) =>
        resp.url().includes("supabase.co") &&
        resp.url().includes("customer_contacts"),
      { timeout: 15_000 },
    );

    await clerkPage.goto("/");
    const resp = await contactRespPromise;

    expect(resp.status(), "Supabase contacts request should succeed").toBe(200);

    const body = (await resp.json()) as Array<{ customer_name: string }>;
    const found = body.some((row) => row.customer_name === QA_CUSTOMER);
    expect(found, `Clerk should see QA contact: ${QA_CUSTOMER}`).toBe(true);
  });

  // ── T11 ───────────────────────────────────────────────────────────────────────
  test("T11 — activity sync: Clerk's browser receives Supabase activity", async () => {
    // waitForResponse + resp.json() races against CDP response-body eviction when
    // multiple Supabase requests fire in parallel on page load. Use page.route()
    // instead — it buffers the body at interception time before it can be evicted.
    let activityBody: Array<{ id: string }> = [];

    await clerkPage.route(
      (url) => url.hostname.includes("supabase.co") && url.pathname.includes("activity_log"),
      async (route) => {
        const response = await route.fetch();
        const text     = await response.text();
        try { activityBody = JSON.parse(text) as Array<{ id: string }>; } catch { /* ignore */ }
        await route.fulfill({ response, body: text });
      },
    );

    await clerkPage.goto("/");
    await clerkPage.waitForLoadState("networkidle");
    await clerkPage.unrouteAll();

    const found = activityBody.some((row) => row.id === QA_ENTRY_ID);
    expect(found, `Clerk should see QA activity entry: ${QA_ENTRY_ID}`).toBe(true);
  });

  // ── T12 ───────────────────────────────────────────────────────────────────────
  test("T12 — Clerk: sign out + protected route redirects to /login", async () => {
    // Workspace mode requires a report in localStorage — inject one
    await clerkPage.goto("/");
    await clerkPage.evaluate(() => {
      localStorage.setItem(
        "pure-collections:report",
        JSON.stringify({
          importedAt:   Date.now(),
          importSource: "excel",
          rows: [{
            customerName:   "Test Customer",
            documentType:   "חשבונית מס",
            documentNumber: 1,
            documentDate:   "2024-01-01",
            dueDate:        "2024-02-01",
            amount:         100,
            currency:       "ILS",
          }],
        }),
      );
    });

    await clerkPage.reload();
    await clerkPage.waitForLoadState("networkidle");

    // Sign-out button lives in CollectionsTable (workspace mode)
    const signOutBtn = clerkPage.getByRole("button", { name: "יציאה" });
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });
    await signOutBtn.click();

    await expect(clerkPage).toHaveURL(/\/login/, { timeout: 10_000 });

    // Protected route should redirect again
    await clerkPage.goto("/");
    await expect(clerkPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ── T13 ───────────────────────────────────────────────────────────────────────
  test("T13 — Ben: sign out + protected route redirects to /login", async () => {
    await benPage.goto("/");
    await benPage.evaluate(() => {
      localStorage.setItem(
        "pure-collections:report",
        JSON.stringify({
          importedAt:   Date.now(),
          importSource: "excel",
          rows: [{
            customerName:   "Test Customer",
            documentType:   "חשבונית מס",
            documentNumber: 1,
            documentDate:   "2024-01-01",
            dueDate:        "2024-02-01",
            amount:         100,
            currency:       "ILS",
          }],
        }),
      );
    });

    await benPage.reload();
    await benPage.waitForLoadState("networkidle");

    const signOutBtn = benPage.getByRole("button", { name: "יציאה" });
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });
    await signOutBtn.click();

    await expect(benPage).toHaveURL(/\/login/, { timeout: 10_000 });

    await benPage.goto("/");
    await expect(benPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

});
