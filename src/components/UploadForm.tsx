"use client";

import { useRef, useState } from "react";
import { extractRivhitRows } from "@/lib/parseRivhit";
import type { RivhitRow } from "@/lib/parseRivhit";

const SETTINGS_KEY = "pure-collections:settings";

function readStoredToken(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "";
    return (JSON.parse(raw) as { rivhitApiToken?: string }).rivhitApiToken ?? "";
  } catch { return ""; }
}

function saveToken(token: string): void {
  try {
    const raw      = localStorage.getItem(SETTINGS_KEY);
    const existing = raw ? (JSON.parse(raw) as object) : {};
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, rivhitApiToken: token }));
  } catch { /* ignore */ }
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

interface SelectedFile {
  name:       string;
  sizeBytes:  number;
  validation: ValidationResult;
}

type ParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "error"; message: string };

type TestState = "none" | "testing" | "ok" | "fail";

function formatSize(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(file: File): ValidationResult {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    return { valid: false, error: "יש לבחור קובץ בפורמט .xlsx בלבד" };
  if (file.size > MAX_SIZE_BYTES)
    return { valid: false, error: `גודל הקובץ (${formatSize(file.size)}) חורג מהמותר (${formatSize(MAX_SIZE_BYTES)})` };
  return { valid: true };
}

export interface UploadFormProps {
  onImport:   (rows: RivhitRow[]) => void;
  onCancel?:  () => void;
  onApiSync?: () => void;
  syncState?: "idle" | "loading" | "success" | "error";
  syncError?: string | null;
}

export function UploadForm({
  onImport,
  onCancel,
  onApiSync,
  syncState = "idle",
  syncError,
}: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<File | null>(null);

  // ── Excel state ──────────────────────────────────────────────────────────────
  const [selected,   setSelected]   = useState<SelectedFile | null>(null);
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });

  // ── API card state ───────────────────────────────────────────────────────────
  // showInput: false when a token is already stored (ready state); true when no token
  const [token,        setToken]        = useState<string>(() =>
    typeof window !== "undefined" ? readStoredToken() : ""
  );
  const [showInput,    setShowInput]    = useState<boolean>(() =>
    typeof window !== "undefined" ? readStoredToken() === "" : true
  );
  const [revealToken,  setRevealToken]  = useState<boolean>(false);
  const [showHelp,     setShowHelp]     = useState<boolean>(false);
  const [testState,    setTestState]    = useState<TestState>("none");
  const [testMessage,  setTestMessage]  = useState<string>("");

  // ── Excel handlers ───────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    setSelected({ name: file.name, sizeBytes: file.size, validation: validate(file) });
    setParseState({ status: "idle" });
    e.target.value = "";
  }

  function clearFile() {
    fileRef.current = null;
    setSelected(null);
    setParseState({ status: "idle" });
  }

  async function handleImport() {
    const file = fileRef.current;
    if (!file || selected?.validation.valid !== true) return;
    setParseState({ status: "parsing" });
    try {
      const buffer = await file.arrayBuffer();
      const XLSX   = await import("xlsx");
      const wb     = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const wsName = wb.SheetNames[0];
      if (!wsName) throw new Error("לא נמצא גיליון בקובץ");
      const ws = wb.Sheets[wsName];
      if (!ws) throw new Error("גיליון ריק");
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
      onImport(extractRivhitRows(rawRows));
    } catch (err) {
      setParseState({
        status:  "error",
        message: err instanceof Error ? err.message : "שגיאה לא ידועה",
      });
    }
  }

  // ── API handlers ─────────────────────────────────────────────────────────────

  function handleTokenChange(value: string) {
    setToken(value);
    saveToken(value);
    // Reset test result whenever the token changes
    if (testState !== "none") { setTestState("none"); setTestMessage(""); }
  }

  async function handleTest() {
    if (!token.trim()) return;
    setTestState("testing");
    try {
      const res  = await fetch("/api/rivhit/type-list", {
        headers: { "X-Rivhit-Token": token.trim() },
      });
      const data = (await res.json()) as { error_code?: number; client_message?: string };
      if (res.status === 502) {
        setTestState("fail");
        setTestMessage("Rivhit אינו זמין — בדוק חיבור לאינטרנט");
        return;
      }
      if (data.error_code === 0) {
        setTestState("ok");
      } else if (typeof data.error_code === "number") {
        setTestState("fail");
        setTestMessage(data.client_message ?? "הבקשה נדחתה");
      } else {
        setTestState("fail");
        setTestMessage("תגובה לא צפויה מהשרת");
      }
    } catch {
      setTestState("fail");
      setTestMessage("שגיאת רשת — בדוק חיבור לאינטרנט");
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isExcelValid   = selected?.validation.valid === true;
  const isExcelParsing = parseState.status === "parsing";
  const isSyncing      = syncState === "loading";
  const canSync        = !isSyncing && token.trim() !== "" && onApiSync !== undefined;
  const hasSyncError   = syncState === "error" && Boolean(syncError);
  const showVerified   = testState === "ok" && !hasSyncError;

  const apiCardBorder = hasSyncError
    ? "border-red-300 bg-red-50"
    : showVerified
    ? "border-green-400 bg-green-50"
    : "border-blue-400 bg-blue-50";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6" dir="rtl">
      <div className="w-full max-w-2xl">

        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="mb-5 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            → חזרה לרשומות
          </button>
        )}

        {/* Page header */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">PURE COLLECTIONS</h1>
          <p className="mt-0.5 text-xs tracking-wide text-gray-400">מערכת גבייה · מבוסס ריווחית</p>
          <p className="mt-4 text-sm font-semibold text-gray-700">כיצד לטעון את נתוני ריווחית שלך?</p>
          <p className="mt-0.5 text-xs text-gray-400">ניתן לעבור בין האפשרויות בכל עת</p>
        </div>

        {/* Two-card grid — RTL: first in DOM = right side of screen */}
        <div className="grid grid-cols-2 items-start gap-4">

          {/* ══════════════════ API CARD ══════════════════ */}
          <div className={`relative rounded-xl border-2 p-5 ${apiCardBorder}`}>

            <span className="absolute left-3 top-3 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
              מומלץ
            </span>

            <p className="mb-1 text-xl">⚡</p>
            <h2 className="text-sm font-bold text-blue-900">סנכרון מריווחית</h2>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-blue-700">
              מסנכרן את כל החשבוניות הפתוחות ישירות מחשבון ריווחית שלך. ללא ייצוא ידני.
            </p>

            {/* Token input — shown when no stored token, or after "שנה טוקן" */}
            {showInput && (
              <div className="mb-3">
                <div className="mb-1.5 flex gap-2">
                  <input
                    type={revealToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    placeholder="הדבק את ה-API Token..."
                    dir="ltr"
                    disabled={isSyncing}
                    className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealToken((v) => !v)}
                    className="shrink-0 rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    {revealToken ? "הסתר" : "הצג"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelp((v) => !v)}
                  className="text-[10px] text-blue-500 transition-colors hover:text-blue-700"
                >
                  {showHelp ? "▲ הסתר" : "▾ היכן מוצאים את הטוקן?"}
                </button>
                {showHelp && (
                  <div className="mt-2 rounded-lg bg-blue-900 px-3 py-2.5 text-[10px] leading-loose text-blue-100">
                    <div className="mb-0.5 font-semibold text-white">כיצד לקבל טוקן API:</div>
                    <div>1. היכנס לחשבון ריווחית שלך</div>
                    <div>2. עבור להגדרות ← API</div>
                    <div>3. העתק את ה-API Token</div>
                    <div>4. הדבק כאן ↑</div>
                  </div>
                )}
              </div>
            )}

            {/* Ready banner — token stored, no test run yet */}
            {!showInput && testState === "none" && !hasSyncError && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-white px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-800">● טוקן API מוגדר</p>
                <p className="mt-0.5 text-[10px] text-blue-500">מוכן לסנכרון</p>
              </div>
            )}

            {/* Testing banner */}
            {testState === "testing" && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-xs text-blue-700">
                ● בודק חיבור...
              </div>
            )}

            {/* Verified banner */}
            {showVerified && (
              <div className="mb-3 rounded-lg border border-green-300 bg-white px-3 py-2.5 text-xs font-semibold text-green-700">
                ✓ חיבור תקין ל-Rivhit
              </div>
            )}

            {/* Test failed banner */}
            {testState === "fail" && (
              <div className="mb-3 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs text-red-700">
                ✗ {testMessage}
              </div>
            )}

            {/* Sync error banner */}
            {hasSyncError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs text-red-700">
                ✗ {syncError}
              </div>
            )}

            {/* Test connection button — only when input visible, token present, not busy */}
            {showInput && token.trim() !== "" && testState !== "testing" && !isSyncing && (
              <button
                type="button"
                onClick={() => { void handleTest(); }}
                className="mb-2 w-full rounded-lg border border-blue-300 bg-white py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                בדוק חיבור
              </button>
            )}

            {/* Sync button */}
            <button
              type="button"
              onClick={() => onApiSync?.()}
              disabled={!canSync}
              className={`w-full rounded-lg py-2.5 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                showVerified
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSyncing ? "מסנכרן..." : "סנכרן עכשיו ←"}
            </button>

            {/* Ready-state links: שנה טוקן · בדוק חיבור */}
            {!showInput && testState !== "testing" && !isSyncing && (
              <div className="mt-2 flex justify-center gap-3 text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowInput(true)}
                  className="text-blue-500 transition-colors hover:text-blue-700"
                >
                  שנה טוקן
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => { void handleTest(); }}
                  className="text-blue-500 transition-colors hover:text-blue-700"
                >
                  בדוק חיבור
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════ EXCEL CARD ══════════════════ */}
          <div className="rounded-xl border-2 border-gray-200 bg-white p-5">

            <p className="mb-1 text-xl">📁</p>
            <h2 className="text-sm font-bold text-gray-800">העלאת קובץ Excel</h2>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-gray-500">
              ייצא קובץ מריווחית ולאחר מכן העלה אותו כאן. מתאים כאשר אין גישת API.
            </p>

            {selected === null ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-gray-300 py-7 text-center text-xs transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                <p className="font-medium text-gray-600">לחץ לבחירת קובץ</p>
                <p className="mt-0.5 text-gray-400">.xlsx בלבד · עד 20 MB</p>
              </button>
            ) : (
              <>
                <div
                  className={`rounded-lg border p-3 ${
                    isExcelValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`break-all text-xs font-medium ${
                        isExcelValid ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {selected.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {formatSize(selected.sizeBytes)}
                    </span>
                  </div>
                  {selected.validation.valid ? (
                    <p className="mt-1 text-[10px] text-green-700">הקובץ תקין ומוכן לייבוא</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-red-600">{selected.validation.error}</p>
                  )}
                </div>

                {parseState.status === "error" && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs text-red-700">{parseState.message}</p>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => { void handleImport(); }}
                    disabled={!isExcelValid || isExcelParsing}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isExcelParsing ? "מייבא..." : "ייבוא הקובץ"}
                  </button>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={isExcelParsing}
                    className="w-full rounded-lg border border-gray-300 py-2 text-xs text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    בחר קובץ אחר
                  </button>
                </div>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

        </div>
      </div>
    </main>
  );
}
