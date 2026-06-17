"use client";

import { useState, useEffect, startTransition } from "react";
import type { ReactNode } from "react";

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

// ── Connection test types ────────────────────────────────────────────────────

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

// ── Document test: analysis types & functions ────────────────────────────────

interface DocFinding {
  fieldPath: string;
  value: string;
}

type DocAnalysis =
  | { kind: "found_links"; links: DocFinding[]; guids: DocFinding[] }
  | { kind: "found_guids_only"; guids: DocFinding[] }
  | { kind: "not_found" }
  | { kind: "rivhit_error"; errorCode: number; message: string }
  | { kind: "proxy_error"; message: string };

const URL_RE = /^https?:\/\//;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function findInObject(
  obj: unknown,
  path: string,
  links: DocFinding[],
  guids: DocFinding[],
) {
  if (typeof obj === "string") {
    if (URL_RE.test(obj)) links.push({ fieldPath: path, value: obj });
    else if (GUID_RE.test(obj)) guids.push({ fieldPath: path, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => findInObject(item, `${path}[${i}]`, links, guids));
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      findInObject(val, path ? `${path}.${key}` : key, links, guids);
    }
  }
}

function analyzeDocResponse(data: unknown): DocAnalysis {
  if (data !== null && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const errField = rec["error"];
    if (typeof errField === "string") return { kind: "proxy_error", message: errField };
    const code = rec["error_code"];
    if (typeof code === "number" && code !== 0) {
      const msg = rec["client_message"];
      return {
        kind: "rivhit_error",
        errorCode: code,
        message: typeof msg === "string" ? msg : "שגיאה לא ידועה",
      };
    }
  }
  const links: DocFinding[] = [];
  const guids: DocFinding[] = [];
  findInObject(data, "", links, guids);
  if (links.length > 0) return { kind: "found_links", links, guids };
  if (guids.length > 0) return { kind: "found_guids_only", guids };
  return { kind: "not_found" };
}

// ── Reusable document test hook ──────────────────────────────────────────────

function useDocTest(
  token: string,
  endpoint: string,
  buildBody: (type: number, num: number) => Record<string, unknown>,
) {
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [analysis, setAnalysis] = useState<DocAnalysis | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    if (!token.trim()) {
      setError("יש להכניס ולשמור טוקן API לפני הבדיקה");
      return;
    }
    const typeNum = parseInt(docType, 10);
    const numNum = parseInt(docNumber, 10);
    if (isNaN(typeNum) || isNaN(numNum)) {
      setError("יש להכניס מספרים תקינים");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setRaw(null);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Rivhit-Token": token.trim(),
        },
        body: JSON.stringify(buildBody(typeNum, numNum)),
      });
      const data: unknown = await res.json();
      setRaw(JSON.stringify(data, null, 2));
      setAnalysis(analyzeDocResponse(data));
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  return { docType, setDocType, docNumber, setDocNumber, analysis, raw, loading, error, runTest };
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
      if (res.status === 502) { setResult({ kind: "unreachable" }); return; }
      if (data.error_code === 0) {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-800">הגדרות מערכת</h1>

      {/* ── API Token ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-700">חיבור ל-Rivhit API</h2>
        <p className="mb-5 text-sm text-gray-500">
          הכנס את ה-API Token מ-Rivhit. נשמר מקומית בדפדפן בלבד.
        </p>
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-600">API Token</label>
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
          <TestResultBanner result={result} />
        )}
        {rawResponse !== null && (
          <RawCollapse raw={rawResponse} />
        )}
      </div>

      {/* ── Document.Details ────────────────────────────────────────────── */}
      <DocTestCard
        title="1 · Document.Details"
        badge="בוצע — לא נמצא קישור"
        badgeColor="gray"
        description="קריאה בלבד. בדיקה קודמת הראתה: המסמך מוחזר אך ללא שדה document_link."
        token={token}
        endpoint="/api/rivhit/document-details"
        buildBody={(t, n) => ({ document_type: t, document_number: n })}
      />

      {/* ── Document.List ───────────────────────────────────────────────── */}
      <DocTestCard
        title="2 · Document.List"
        badge="ממתין לבדיקה"
        badgeColor="blue"
        description="קריאה בלבד. בודק האם רשימת מסמכים מכילה שדה document_link או URL לכל פריט."
        token={token}
        endpoint="/api/rivhit/document-list"
        buildBody={(t, n) => ({
          from_document_type: t,
          to_document_type: t,
          from_document_number: n,
          to_document_number: n,
        })}
      />

      {/* ── Document.Copy ───────────────────────────────────────────────── */}
      <DocTestCard
        title="3 · Document.Copy"
        badge="יוצר עותק — בדוק בזהירות"
        badgeColor="amber"
        description="מחזיר document_link מאומת. שולח force_copy: false כדי לבקש עותק קיים אם יש. לאחר הבדיקה — בדוק ב-Rivhit שלא נוצר מסמך נוסף."
        note={
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-semibold">⚠️ קרא לפני הפעלה</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed">
              <li>בדיקה זו עלולה ליצור מסמך/עותק חדש ב-Rivhit.</li>
              <li>הפעל פעם אחת בלבד, על מסמך בסיכון נמוך (לא חשבונית פתוחה של לקוח פעיל).</li>
              <li>לאחר הבדיקה — כנס ל-Rivhit ובדוק ידנית אם נוצר מסמך חדש.</li>
              <li>אם נוצר מסמך חדש — הגישה תיפסל. אם לא נוצר — ניתן להמשיך.</li>
            </ul>
          </div>
        }
        token={token}
        endpoint="/api/rivhit/document-copy"
        buildBody={(t, n) => ({ document_type: t, document_number: n })}
      />
    </div>
  );
}

// ── Connection test result banner ────────────────────────────────────────────

type RenderedResult = Exclude<TestResult, { kind: "idle" } | { kind: "loading" }>;

function TestResultBanner({ result }: { result: RenderedResult }) {
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

// ── Raw JSON collapsible ─────────────────────────────────────────────────────

function RawCollapse({ raw }: { raw: string }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-gray-400 hover:text-gray-600">
        פרטים טכניים ▸
      </summary>
      <pre className="mt-2 overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100" dir="ltr">
        {raw}
      </pre>
    </details>
  );
}

// ── Document.Details analysis banner ────────────────────────────────────────

function DocAnalysisBanner({ analysis }: { analysis: DocAnalysis }) {
  if (analysis.kind === "found_links") {
    return (
      <div className="mt-4 rounded-lg bg-green-50 px-4 py-4 text-sm text-green-800">
        <p className="font-semibold">✅ נמצאו קישורים לצפייה במסמך</p>
        <ul className="mt-2 space-y-2">
          {analysis.links.map((l) => (
            <li key={l.fieldPath} dir="ltr" className="break-all">
              <span className="font-mono text-xs text-green-600">{l.fieldPath}:</span>{" "}
              <a href={l.value} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-900">
                פתח קישור ↗
              </a>
            </li>
          ))}
        </ul>
        {analysis.guids.length > 0 && (
          <div className="mt-3 border-t border-green-200 pt-2">
            <p className="text-xs text-green-600">זיהויי GUID נוספים:</p>
            {analysis.guids.map((g) => (
              <p key={g.fieldPath} dir="ltr" className="mt-1 font-mono text-xs">{g.fieldPath}: {g.value}</p>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (analysis.kind === "found_guids_only") {
    return (
      <div className="mt-4 rounded-lg bg-blue-50 px-4 py-4 text-sm text-blue-800">
        <p className="font-semibold">✅ נמצא זיהוי מסמך (GUID) — אין URL ישיר</p>
        <ul className="mt-2 space-y-1">
          {analysis.guids.map((g) => (
            <li key={g.fieldPath} dir="ltr" className="break-all font-mono text-xs">
              <span className="text-blue-500">{g.fieldPath}:</span> {g.value}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (analysis.kind === "not_found") {
    return (
      <div className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
        ⚠️ לא נמצא קישור PDF או זיהוי מסמך בתגובה זו
      </div>
    );
  }
  if (analysis.kind === "rivhit_error") {
    return (
      <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        ❌ שגיאה מ-Rivhit: {analysis.message}{" "}
        <span className="text-xs text-red-400">(error_code: {analysis.errorCode})</span>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
      ❌ שגיאה: {analysis.message}
    </div>
  );
}

// ── Reusable document test card ──────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  gray:  "bg-gray-100 text-gray-500",
  blue:  "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
};

interface DocTestCardProps {
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  note?: ReactNode;
  token: string;
  endpoint: string;
  buildBody: (type: number, num: number) => Record<string, unknown>;
}

function DocTestCard({
  title, badge, badgeColor, description, note, token, endpoint, buildBody,
}: DocTestCardProps) {
  const { docType, setDocType, docNumber, setDocNumber, analysis, raw, loading, error, runTest } =
    useDocTest(token, endpoint, buildBody);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-700">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[badgeColor] ?? BADGE_STYLES["gray"]}`}>
          {badge}
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      {note}

      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">סוג מסמך (מספר)</label>
          <input
            type="number"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            placeholder="לדוגמה: 1"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            dir="ltr"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">מספר מסמך</label>
          <input
            type="number"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="לדוגמה: 12345"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            dir="ltr"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => { void runTest(); }}
        disabled={loading || !docType || !docNumber}
        className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "שולח..." : "בדוק מסמך"}
      </button>

      {error !== null && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {analysis !== null && <DocAnalysisBanner analysis={analysis} />}
      {raw !== null && <RawCollapse raw={raw} />}
    </div>
  );
}
