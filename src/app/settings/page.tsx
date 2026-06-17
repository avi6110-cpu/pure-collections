"use client";

import { useState, useEffect, startTransition } from "react";

// ── Persistence ──────────────────────────────────────────────────────────────

const SETTINGS_KEY = "pure-collections:settings";

interface PersistedSettings {
  rivhitApiToken?: string;
}

function readSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return {};
  }
}

function writeSettings(patch: PersistedSettings) {
  try {
    const existing = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch {}
}

// ── Types ────────────────────────────────────────────────────────────────────

type TestResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; typeCount: number }
  | { kind: "bad_token"; message: string }
  | { kind: "unreachable" }
  | { kind: "no_token" }
  | { kind: "error"; message: string };

interface RivhitDocumentType {
  document_type?: number;
  document_type_name?: string;
}

interface RivhitResponse {
  error_code?: number;
  client_message?: string;
  data?: { document_type_list?: RivhitDocumentType[] };
}

// ── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<TestResult>({ kind: "idle" });
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  useEffect(() => {
    const settings = readSettings();
    startTransition(() => setToken(settings.rivhitApiToken ?? ""));
  }, []);

  function handleSave() {
    writeSettings({ rivhitApiToken: token });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    if (!token.trim()) {
      setResult({ kind: "no_token" });
      setRawResponse(null);
      return;
    }
    setResult({ kind: "loading" });
    setRawResponse(null);
    try {
      const res = await fetch("/api/rivhit/type-list", {
        headers: { "X-Rivhit-Token": token.trim() },
      });
      const data = (await res.json()) as RivhitResponse;
      setRawResponse(JSON.stringify(data, null, 2));
      if (res.status === 502) {
        setResult({ kind: "unreachable" });
        return;
      }
      if (data.error_code === 0) {
        const typeCount = data.data?.document_type_list?.length ?? 0;
        setResult({ kind: "success", typeCount });
      } else if (typeof data.error_code === "number") {
        setResult({
          kind: "bad_token",
          message: data.client_message ?? "הבקשה נדחתה על ידי Rivhit",
        });
      } else {
        setResult({ kind: "error", message: "תגובה לא צפויה מהשרת" });
      }
    } catch {
      setResult({ kind: "error", message: "שגיאת רשת" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-800">הגדרות מערכת</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-700">
          חיבור ל-Rivhit API
        </h2>
        <p className="mb-5 text-sm text-gray-500">
          הכנס את ה-API Token מ-Rivhit. הטוקן נשמר מקומית בדפדפן בלבד ולא
          מועבר לשום שרת חיצוני.
        </p>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-600">
            API Token
          </label>
          <div className="flex gap-2">
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
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
          >
            {saved ? "נשמר ✓" : "שמור"}
          </button>
          <button
            type="button"
            onClick={() => { void handleTest(); }}
            disabled={result.kind === "loading"}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {result.kind === "loading" ? "בודק..." : "בדוק חיבור"}
          </button>
        </div>

        {result.kind !== "idle" && result.kind !== "loading" && (
          <TestResultBanner result={result} />
        )}

        {rawResponse !== null && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-gray-400">
              תגובת API גולמית
            </p>
            <pre className="overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100" dir="ltr">
              {rawResponse}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Result banner ────────────────────────────────────────────────────────────

type RenderedResult = Exclude<TestResult, { kind: "idle" } | { kind: "loading" }>;

function TestResultBanner({ result }: { result: RenderedResult }) {
  if (result.kind === "success") {
    return (
      <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        ✓ חיבור תקין — {result.typeCount} סוגי מסמכים נמצאו ב-Rivhit
      </div>
    );
  }
  if (result.kind === "bad_token") {
    return (
      <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        ✗ טוקן שגוי — {result.message}
      </div>
    );
  }
  if (result.kind === "unreachable") {
    return (
      <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        ✗ Rivhit אינו זמין — בדוק חיבור לאינטרנט
      </div>
    );
  }
  if (result.kind === "no_token") {
    return (
      <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
        יש להכניס טוקן לפני הבדיקה
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
      ✗ שגיאה — {result.message}
    </div>
  );
}
