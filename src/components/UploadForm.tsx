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
    const raw = localStorage.getItem(SETTINGS_KEY);
    const existing = raw ? (JSON.parse(raw) as object) : {};
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, rivhitApiToken: token }));
  } catch { /* ignore */ }
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

interface SelectedFile {
  name: string;
  sizeBytes: number;
  validation: ValidationResult;
}

type ParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "error"; message: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validate(file: File): ValidationResult {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    return { valid: false, error: "יש לבחור קובץ בפורמט .xlsx בלבד" };
  if (file.size > MAX_SIZE_BYTES)
    return {
      valid: false,
      error: `גודל הקובץ (${formatSize(file.size)}) חורג מהמותר (${formatSize(MAX_SIZE_BYTES)})`,
    };
  return { valid: true };
}

export interface UploadFormProps {
  onImport: (rows: RivhitRow[]) => void;
  onCancel?: () => void;
  onApiSync?: () => void;
  syncState?: "idle" | "loading" | "success" | "error";
  syncError?: string | null;
}

export function UploadForm({ onImport, onCancel, onApiSync, syncState = "idle", syncError }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<File | null>(null);
  const [selected,   setSelected]   = useState<SelectedFile | null>(null);
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });
  const [token, setToken] = useState<string>(() =>
    typeof window !== "undefined" ? readStoredToken() : ""
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;
    setSelected({ name: file.name, sizeBytes: file.size, validation: validate(file) });
    setParseState({ status: "idle" });
    e.target.value = "";
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
        status: "error",
        message: err instanceof Error ? err.message : "שגיאה לא ידועה",
      });
    }
  }

  const isValid   = selected?.validation.valid === true;
  const isParsing = parseState.status === "parsing";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="mb-5 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            → חזרה לרשומות
          </button>
        )}

        <h1 className="text-xl font-semibold text-gray-900">ייבוא דוח גבייה</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">בחר כיצד לטעון את הנתונים</p>

        {onApiSync !== undefined && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">טוקן API של ריווחית</label>
            <input
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                saveToken(e.target.value);
              }}
              placeholder="הכנס טוקן..."
              dir="ltr"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <button
              type="button"
              onClick={onApiSync}
              disabled={syncState === "loading" || token.trim() === ""}
              className="mt-2 w-full rounded-lg border-2 border-blue-400 bg-blue-50 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncState === "loading" ? "מסנכרן..." : "סנכרן מ-API של ריווחית"}
            </button>
            {syncState === "error" && syncError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{syncError}</p>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">או</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 px-8 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <p className="text-sm font-medium text-gray-600">לחץ לבחירת קובץ Excel</p>
          <p className="mt-1 text-xs text-gray-400">.xlsx בלבד · עד 20 MB</p>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        {selected !== null && (
          <div
            className={`mt-4 rounded-lg border p-3 ${
              isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`break-all text-sm font-medium ${
                  isValid ? "text-green-800" : "text-red-800"
                }`}
              >
                {selected.name}
              </span>
              <span className="shrink-0 text-xs text-gray-500">{formatSize(selected.sizeBytes)}</span>
            </div>
            {selected.validation.valid ? (
              <p className="mt-1 text-xs text-green-700">הקובץ תקין ומוכן לייבוא</p>
            ) : (
              <p className="mt-1 text-xs text-red-600">{selected.validation.error}</p>
            )}
          </div>
        )}

        {parseState.status === "error" && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{parseState.message}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={!isValid || isParsing}
          className="mt-5 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isParsing ? "מייבא..." : "ייבוא הקובץ"}
        </button>
      </div>
    </main>
  );
}
