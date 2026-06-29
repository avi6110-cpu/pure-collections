"use client";

import { useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION = "0.1.0";
const SETTINGS_KEY = "pure-collections:settings";
const REPORT_KEY   = "pure-collections:report";

// ── Persistence ──────────────────────────────────────────────────────────────

interface PersistedSettings {
  rivhitApiToken?: string;
}

interface StoredReport {
  importedAt?:   number;
  importSource?: "api" | "excel";
}

function readSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedSettings;
  } catch { return {}; }
}

function writeSettings(patch: PersistedSettings): void {
  try {
    const existing = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch {}
}

function readSystemInfo(): { importedAt: number | null; importSource: "api" | "excel" | null } {
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

// ── Connection test ──────────────────────────────────────────────────────────

type TestResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; typeCount: number }
  | { kind: "bad_token"; message: string }
  | { kind: "unreachable" }
  | { kind: "no_token" }
  | { kind: "error"; message: string };

interface RivhitResponse {
  error_code?:     number;
  client_message?: string;
  data?: { document_type_list?: unknown[] };
}

// ── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [token, setToken]         = useState<string>(
    () => typeof window !== "undefined" ? readSettings().rivhitApiToken ?? "" : ""
  );
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [result, setResult]       = useState<TestResult>({ kind: "idle" });
  const [sysInfo]                 = useState(
    () => typeof window !== "undefined" ? readSystemInfo() : { importedAt: null, importSource: null }
  );

  function handleSave() {
    writeSettings({ rivhitApiToken: token });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    if (!token.trim()) { setResult({ kind: "no_token" }); return; }
    setResult({ kind: "loading" });
    try {
      const res  = await fetch("/api/rivhit/type-list", {
        headers: { "X-Rivhit-Token": token.trim() },
      });
      const data = (await res.json()) as RivhitResponse;
      if (res.status === 502) { setResult({ kind: "unreachable" }); return; }
      if (data.error_code === 0) {
        writeSettings({ rivhitApiToken: token });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setResult({ kind: "success", typeCount: data.data?.document_type_list?.length ?? 0 });
      } else if (typeof data.error_code === "number") {
        setResult({ kind: "bad_token", message: data.client_message ?? "הבקשה נדחתה" });
      } else {
        setResult({ kind: "error", message: "תגובה לא צפויה מהשרת" });
      }
    } catch {
      setResult({ kind: "error", message: "שגיאת רשת" });
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

        {/* ── Rivhit connection ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-700">חיבור ל-Rivhit</h2>
          <p className="mb-5 text-sm text-gray-500">
            טוקן ה-API נשמר מקומית בדפדפן בלבד ואינו נשלח לשום שרת חיצוני.
          </p>

          <label className="mb-1.5 block text-sm font-medium text-gray-600">API Token</label>
          <div className="mb-4 flex gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="הדבק את ה-API Token כאן"
              className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              dir="ltr"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              {showToken ? "הסתר" : "הצג"}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {saved ? "נשמר ✓" : "שמור"}
            </button>
            <button
              type="button"
              onClick={() => { void handleTest(); }}
              disabled={result.kind === "loading"}
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50"
            >
              {result.kind === "loading" ? "בודק..." : "בדוק חיבור"}
            </button>
          </div>

          {result.kind !== "idle" && result.kind !== "loading" && (
            <ConnectionResult result={result} />
          )}
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
  if (result.kind === "bad_token")
    return <div className={`${base} bg-red-50 text-red-700`}>✗ טוקן שגוי — {result.message}</div>;
  if (result.kind === "unreachable")
    return <div className={`${base} bg-red-50 text-red-700`}>✗ Rivhit אינו זמין — בדוק חיבור לאינטרנט</div>;
  if (result.kind === "no_token")
    return <div className={`${base} bg-amber-50 text-amber-700`}>יש להכניס טוקן לפני הבדיקה</div>;
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
