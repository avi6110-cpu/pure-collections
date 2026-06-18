"use client";

import { useState } from "react";
import type { ReactNode } from "react";

// ── Token reader ─────────────────────────────────────────────────────────────

function readToken(): string {
  try {
    const raw = localStorage.getItem("pure-collections:settings");
    if (!raw) return "";
    return (JSON.parse(raw) as { rivhitApiToken?: string }).rivhitApiToken ?? "";
  } catch { return ""; }
}

// ── Document analysis types ──────────────────────────────────────────────────

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

const URL_RE  = /^https?:\/\//;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function findInObject(
  obj: unknown,
  path: string,
  links: DocFinding[],
  guids: DocFinding[],
): void {
  if (typeof obj === "string") {
    if (URL_RE.test(obj))  links.push({ fieldPath: path, value: obj });
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
    if (typeof rec["error"] === "string") return { kind: "proxy_error", message: rec["error"] };
    const code = rec["error_code"];
    if (typeof code === "number" && code !== 0) {
      const msg = rec["client_message"];
      return { kind: "rivhit_error", errorCode: code, message: typeof msg === "string" ? msg : "שגיאה לא ידועה" };
    }
  }
  const links: DocFinding[] = [];
  const guids: DocFinding[] = [];
  findInObject(data, "", links, guids);
  if (links.length > 0) return { kind: "found_links", links, guids };
  if (guids.length > 0) return { kind: "found_guids_only", guids };
  return { kind: "not_found" };
}

// ── useDocTest hook ──────────────────────────────────────────────────────────

function useDocTest(
  token: string,
  endpoint: string,
  buildBody: (type: number, num: number) => Record<string, unknown>,
) {
  const [docType,   setDocType]   = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [analysis,  setAnalysis]  = useState<DocAnalysis | null>(null);
  const [raw,       setRaw]       = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function runTest() {
    if (!token.trim()) { setError("יש להכניס טוקן API בהגדרות לפני הבדיקה"); return; }
    const typeNum = parseInt(docType, 10);
    const numNum  = parseInt(docNumber, 10);
    if (isNaN(typeNum) || isNaN(numNum)) { setError("יש להכניס מספרים תקינים"); return; }
    setLoading(true); setAnalysis(null); setRaw(null); setError(null);
    try {
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "X-Rivhit-Token": token.trim() },
        body:    JSON.stringify(buildBody(typeNum, numNum)),
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

// ── Dev page ─────────────────────────────────────────────────────────────────

export default function DevPage() {
  const [token] = useState<string>(
    () => typeof window !== "undefined" ? readToken() : ""
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-5">

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">⚠️ כלי פיתוח בלבד</p>
          <p className="mt-1 text-xs text-amber-700">
            דף זה מיועד לבדיקות API של המפתח בלבד. אין לשתף קישור זה עם משתמשי קצה.
            {!token && (
              <span className="mt-1 block font-medium text-amber-900">
                לא נמצא טוקן API — יש להגדירו בדף{" "}
                <a href="/settings" className="underline">/settings</a> תחילה.
              </span>
            )}
          </p>
        </div>

        <DocTestCard
          title="Document.Details"
          badge="בוצע — לא נמצא קישור"
          badgeColor="gray"
          description="קריאה בלבד. בדיקה קודמת הראתה: המסמך מוחזר אך ללא שדה document_link."
          token={token}
          endpoint="/api/rivhit/document-details"
          buildBody={(t, n) => ({ document_type: t, document_number: n })}
        />

        <DocTestCard
          title="Document.List"
          badge="ממתין לבדיקה"
          badgeColor="blue"
          description="קריאה בלבד. בודק האם רשימת מסמכים מכילה שדה document_link או URL לכל פריט."
          token={token}
          endpoint="/api/rivhit/document-list"
          buildBody={(t, n) => ({
            from_document_type:   t,
            to_document_type:     t,
            from_document_number: n,
            to_document_number:   n,
          })}
        />

        <DocTestCard
          title="Document.Copy"
          badge="יוצר עותק — בדוק בזהירות"
          badgeColor="amber"
          description="מחזיר document_link מאומת. שולח force_copy: false לבקשת עותק קיים אם יש."
          note={
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-semibold">⚠️ קרא לפני הפעלה</p>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed">
                <li>בדיקה זו עלולה ליצור מסמך/עותק חדש ב-Rivhit.</li>
                <li>הפעל פעם אחת בלבד, על מסמך בסיכון נמוך (לא חשבונית פתוחה של לקוח פעיל).</li>
                <li>לאחר הבדיקה — כנס ל-Rivhit ובדוק ידנית אם נוצר מסמך חדש.</li>
              </ul>
            </div>
          }
          token={token}
          endpoint="/api/rivhit/document-copy"
          buildBody={(t, n) => ({ document_type: t, document_number: n })}
        />

      </div>
    </div>
  );
}

// ── DocAnalysisBanner ────────────────────────────────────────────────────────

function DocAnalysisBanner({ analysis }: { analysis: DocAnalysis }) {
  if (analysis.kind === "found_links") {
    return (
      <div className="mt-4 rounded-lg bg-green-50 px-4 py-4 text-sm text-green-800">
        <p className="font-semibold">✅ נמצאו קישורים לצפייה במסמך</p>
        <ul className="mt-2 space-y-2">
          {analysis.links.map((l) => (
            <li key={l.fieldPath} dir="ltr" className="break-all">
              <span className="font-mono text-xs text-green-600">{l.fieldPath}:</span>{" "}
              <a href={l.value} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-900">פתח קישור ↗</a>
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
  if (analysis.kind === "not_found")
    return <div className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">⚠️ לא נמצא קישור PDF או זיהוי מסמך בתגובה זו</div>;
  if (analysis.kind === "rivhit_error")
    return (
      <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        ❌ שגיאה מ-Rivhit: {analysis.message}{" "}
        <span className="text-xs text-red-400">(error_code: {analysis.errorCode})</span>
      </div>
    );
  return <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">❌ שגיאה: {analysis.message}</div>;
}

// ── RawCollapse ──────────────────────────────────────────────────────────────

function RawCollapse({ raw }: { raw: string }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-gray-400 hover:text-gray-600">
        תגובה גולמית (JSON) ▸
      </summary>
      <pre className="mt-2 overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100" dir="ltr">
        {raw}
      </pre>
    </details>
  );
}

// ── DocTestCard ──────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  gray:  "bg-gray-100 text-gray-500",
  blue:  "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
};

interface DocTestCardProps {
  title:     string;
  badge:     string;
  badgeColor: string;
  description: string;
  note?:     ReactNode;
  token:     string;
  endpoint:  string;
  buildBody: (type: number, num: number) => Record<string, unknown>;
}

function DocTestCard({ title, badge, badgeColor, description, note, token, endpoint, buildBody }: DocTestCardProps) {
  const { docType, setDocType, docNumber, setDocNumber, analysis, raw, loading, error, runTest } =
    useDocTest(token, endpoint, buildBody);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
