"use client";

import { useEffect, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION    = "0.1.0";
const REPORT_KEY     = "pure-collections:report";
const SETTINGS_KEY   = "pure-collections:settings";
const CONTACTS_KEY   = "pure-collections:contacts";
const STATUSES_KEY   = "pure-collections:status";
const ACTIVITY_KEY   = "pure-collections:activity";

// ── Persistence helpers ──────────────────────────────────────────────────────

interface StoredSettings { rivhitApiToken?: string }
interface StoredReport   { importedAt?: number; importSource?: "api" | "excel" }

function readLocalToken(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "";
    return (JSON.parse(raw) as StoredSettings).rivhitApiToken ?? "";
  } catch { return ""; }
}

function clearLocalToken(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const cur: StoredSettings = raw ? (JSON.parse(raw) as StoredSettings) : {};
    delete cur.rivhitApiToken;
    if (Object.keys(cur).length === 0) {
      localStorage.removeItem(SETTINGS_KEY);
    } else {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cur));
    }
  } catch {}
}

interface MigrationCounts { contacts: number; statuses: number; activity: number }

function readLocalCounts(): MigrationCounts {
  try {
    const contacts  = Object.keys((JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? "{}") as Record<string, unknown>)).length;
    const statuses  = Object.keys((JSON.parse(localStorage.getItem(STATUSES_KEY) ?? "{}") as Record<string, unknown>)).length;
    const actLog    = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "{}") as Record<string, unknown[]>;
    const activity  = Object.values(actLog).reduce((sum, arr) => sum + arr.length, 0);
    return { contacts, statuses, activity };
  } catch { return { contacts: 0, statuses: 0, activity: 0 }; }
}

function readLocalPayload(): object {
  try {
    const contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? "{}") as object;
    const statuses = JSON.parse(localStorage.getItem(STATUSES_KEY) ?? "{}") as object;
    const activity = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "{}") as object;
    return { contacts, statuses, activity };
  } catch { return { contacts: {}, statuses: {}, activity: {} }; }
}

async function runBulkMigration(): Promise<{ ok: true; migrated: MigrationCounts } | { ok: false; error: string }> {
  try {
    const payload = readLocalPayload();
    const res  = await fetch("/api/migrate/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; migrated?: MigrationCounts; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "שגיאה לא ידועה" };
    return { ok: true, migrated: data.migrated ?? { contacts: 0, statuses: 0, activity: 0 } };
  } catch {
    return { ok: false, error: "שגיאת רשת" };
  }
}

function readSystemInfo() {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (!raw) return { importedAt: null, importSource: null };
    const stored = JSON.parse(raw) as StoredReport;
    return {
      importedAt:   stored.importedAt   ?? null,
      importSource: stored.importSource ?? null,
    };
  } catch { return { importedAt: null, importSource: null }; }
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchVaultHint(): Promise<string | null> {
  try {
    const res  = await fetch("/api/settings/rivhit-token");
    const data = (await res.json()) as { hint?: string | null };
    return data.hint ?? null;
  } catch { return null; }
}

async function saveToVault(token: string): Promise<{ ok: true; hint: string } | { ok: false; error: string }> {
  try {
    const res  = await fetch("/api/settings/rivhit-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as { hint?: string; error?: string };
    if (!res.ok || !data.hint) {
      return { ok: false, error: data.error ?? "שגיאה לא ידועה" };
    }
    return { ok: true, hint: data.hint };
  } catch {
    return { ok: false, error: "שגיאת רשת" };
  }
}

// ── Test-connection result ───────────────────────────────────────────────────

type TestResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; typeCount: number }
  | { kind: "no_vault_token" }
  | { kind: "bad_token"; message: string }
  | { kind: "unreachable" }
  | { kind: "error"; message: string };

interface RivhitResponse {
  error_code?:     number;
  client_message?: string;
  data?: { document_type_list?: unknown[] };
}

// ── Settings page ────────────────────────────────────────────────────────────

type MigrateState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; migrated: MigrationCounts }
  | { kind: "error"; message: string };

export default function SettingsPage() {
  const [vaultHint,      setVaultHint]      = useState<string | null>(null);
  const [hasLocalToken,  setHasLocalToken]  = useState(false);
  const [newToken,       setNewToken]       = useState("");
  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [savedOk,        setSavedOk]        = useState(false);
  const [testResult,     setTestResult]     = useState<TestResult>({ kind: "idle" });
  const [localCounts,    setLocalCounts]    = useState<MigrationCounts>({ contacts: 0, statuses: 0, activity: 0 });
  const [migrateState,   setMigrateState]   = useState<MigrateState>({ kind: "idle" });
  const [sysInfo]                           = useState(
    () => typeof window !== "undefined" ? readSystemInfo() : { importedAt: null, importSource: null }
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    void fetchVaultHint().then(setVaultHint);
    setHasLocalToken(readLocalToken() !== "");
    setLocalCounts(readLocalCounts());
  }, []);

  async function handleSave() {
    const trimmed = newToken.trim();
    if (!trimmed) { setSaveError("הטוקן לא יכול להיות ריק"); return; }
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);

    const result = await saveToVault(trimmed);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    setVaultHint(result.hint);
    setNewToken("");
    setSavedOk(true);
    clearLocalToken();
    setHasLocalToken(false);
    setTimeout(() => setSavedOk(false), 3000);
  }

  async function handleTest() {
    setTestResult({ kind: "loading" });
    try {
      const res  = await fetch("/api/rivhit/type-list");
      if (res.status === 401) { setTestResult({ kind: "no_vault_token" }); return; }
      if (res.status === 502) { setTestResult({ kind: "unreachable" }); return; }
      const data = (await res.json()) as RivhitResponse;
      if (data.error_code === 0) {
        setTestResult({ kind: "success", typeCount: data.data?.document_type_list?.length ?? 0 });
      } else if (typeof data.error_code === "number") {
        setTestResult({ kind: "bad_token", message: data.client_message ?? "הבקשה נדחתה" });
      } else {
        setTestResult({ kind: "error", message: "תגובה לא צפויה מהשרת" });
      }
    } catch {
      setTestResult({ kind: "error", message: "שגיאת רשת" });
    }
  }

  async function handleMigrate() {
    setMigrateState({ kind: "running" });
    const result = await runBulkMigration();
    if (result.ok) {
      setMigrateState({ kind: "done", migrated: result.migrated });
    } else {
      setMigrateState({ kind: "error", message: result.error });
    }
  }

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleString("he-IL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-lg space-y-5">

        <h1 className="text-xl font-bold text-gray-800">הגדרות</h1>

        {/* ── Migration banner ───────────────────────────────────────────── */}
        {hasLocalToken && vaultHint === null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold">נמצא טוקן Rivhit מקומי</p>
            <p className="mt-1 text-amber-700">
              הטוקן שמור רק בדפדפן זה ולא ב-Vault. הדבק אותו שוב בשדה למטה ולחץ &quot;שמור ב-Vault&quot; כדי להגן עליו ולאפשר סנכרון מכל מכשיר.
            </p>
          </div>
        )}

        {/* ── Rivhit connection ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-700">חיבור ל-Rivhit</h2>
          <p className="mb-4 text-sm text-gray-500">
            הטוקן נשמר ב-Vault מוצפן. הוא אינו מוצג ואינו נשלח לדפדפן.
          </p>

          {/* Current vault state */}
          <div className="mb-5 flex items-center gap-2 text-sm">
            <span className="text-gray-500">מצב נוכחי:</span>
            {vaultHint !== null ? (
              <span className="rounded-md bg-green-50 px-2 py-0.5 font-mono text-xs text-green-700">
                {vaultHint}
              </span>
            ) : (
              <span className="text-gray-400">לא הוגדר</span>
            )}
          </div>

          <label className="mb-1.5 block text-sm font-medium text-gray-600">
            הדבק טוקן חדש
          </label>
          <div className="mb-4">
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="הדבק את ה-API Token כאן"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              dir="ltr"
              autoComplete="off"
            />
          </div>

          {saveError && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving || !newToken.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "שומר…" : savedOk ? "נשמר ב-Vault ✓" : "שמור ב-Vault"}
            </button>
            <button
              type="button"
              onClick={() => { void handleTest(); }}
              disabled={testResult.kind === "loading"}
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50"
            >
              {testResult.kind === "loading" ? "בודק..." : "בדוק חיבור"}
            </button>
          </div>

          {testResult.kind !== "idle" && testResult.kind !== "loading" && (
            <ConnectionResult result={testResult} />
          )}
        </section>

        {/* ── Data migration ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-700">סנכרון נתונים לענן</h2>
          <p className="mb-4 text-sm text-gray-500">
            מעלה נתוני אנשי קשר, סטטוסים ויומן פעילות מהאחסון המקומי של הדפדפן לענן.
            הפעולה בטוחה — ניתן לבצע אותה מספר פעמים ולא ייווצרו כפילויות.
            הנתונים המקומיים לא נמחקים.
          </p>

          <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span className="font-medium">נמצא באחסון המקומי: </span>
            {localCounts.contacts} אנשי קשר,&nbsp;
            {localCounts.statuses} סטטוסים,&nbsp;
            {localCounts.activity} רשומות יומן
          </div>

          {migrateState.kind === "done" && (
            <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ הסנכרון הושלם — עודכנו {migrateState.migrated.contacts} אנשי קשר,&nbsp;
              {migrateState.migrated.statuses} סטטוסים,&nbsp;
              {migrateState.migrated.activity} רשומות יומן
            </div>
          )}

          {migrateState.kind === "error" && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠️ הסנכרון נכשל — הנתונים המקומיים שמורים. ניתן לנסות שוב.
              <br />
              <span className="text-xs opacity-75">{migrateState.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => { void handleMigrate(); }}
            disabled={migrateState.kind === "running"}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {migrateState.kind === "running" ? "מסנכרן…" :
             migrateState.kind === "done"    ? "סנכרן שוב" :
             "סנכרן לענן"}
          </button>
        </section>

        {/* ── System information ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-700">מידע על המערכת</h2>
          <dl className="space-y-3">
            <InfoRow label="גרסת אפליקציה" value={APP_VERSION} />
            <InfoRow
              label="ייבוא אחרון"
              value={sysInfo.importedAt !== null ? fmtDate(sysInfo.importedAt) : "—"}
            />
            <InfoRow
              label="מקור נתונים"
              value={
                sysInfo.importSource === "api"   ? "Rivhit API" :
                sysInfo.importSource === "excel" ? "Excel" :
                "—"
              }
            />
          </dl>
        </section>

      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

type RenderedResult = Exclude<TestResult, { kind: "idle" } | { kind: "loading" }>;

function ConnectionResult({ result }: { result: RenderedResult }) {
  const base = "mt-4 rounded-lg px-4 py-3 text-sm";
  if (result.kind === "success")
    return <div className={`${base} bg-green-50 text-green-700`}>✓ חיבור תקין — {result.typeCount} סוגי מסמכים נמצאו</div>;
  if (result.kind === "no_vault_token")
    return <div className={`${base} bg-amber-50 text-amber-700`}>טוקן לא הוגדר ב-Vault — שמור טוקן חדש תחילה</div>;
  if (result.kind === "bad_token")
    return <div className={`${base} bg-red-50 text-red-700`}>✗ טוקן שגוי — {result.message}</div>;
  if (result.kind === "unreachable")
    return <div className={`${base} bg-red-50 text-red-700`}>✗ Rivhit אינו זמין — בדוק חיבור לאינטרנט</div>;
  return <div className={`${base} bg-red-50 text-red-700`}>✗ שגיאה — {result.message}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 tabular-nums">{value}</dd>
    </div>
  );
}
