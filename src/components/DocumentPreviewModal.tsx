"use client";

import { useEffect, useState } from "react";
import { DOC_TYPE_NUM } from "@/lib/parseRivhitApi";

// ── Types ────────────────────────────────────────────────────────────────────

type PreviewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; url: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function readToken(): string {
  try {
    const raw = localStorage.getItem("pure-collections:settings");
    if (!raw) return "";
    return (JSON.parse(raw) as { rivhitApiToken?: string }).rivhitApiToken ?? "";
  } catch { return ""; }
}

function findFirstUrl(data: unknown): string | null {
  if (typeof data === "string") return /^https?:\/\//.test(data) ? data : null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findFirstUrl(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (data !== null && typeof data === "object") {
    for (const val of Object.values(data as Record<string, unknown>)) {
      const found = findFirstUrl(val);
      if (found !== null) return found;
    }
  }
  return null;
}

// ── Eye icon ─────────────────────────────────────────────────────────────────

function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DocumentPreviewModalProps {
  documentType:   string;   // Hebrew name (e.g. "חשבונית מס")
  documentNumber: number;
  onClose:        () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentPreviewModal({
  documentType,
  documentNumber,
  onClose,
}: DocumentPreviewModalProps) {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });

  // Escape key closes modal — capture phase so it fires before CustomerPanel's handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    }
    document.addEventListener("keydown", handleKey, { capture: true });
    return () => document.removeEventListener("keydown", handleKey, { capture: true });
  }, [onClose]);

  // Fetch document link from Document.Copy on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchLink() {
      const token = readToken();
      if (!token) {
        if (!cancelled) setState({ kind: "error", message: "טוקן API לא מוגדר — פתח הגדרות והכנס את הטוקן" });
        return;
      }

      const typeNum = DOC_TYPE_NUM[documentType.trim()];
      if (typeNum === undefined) {
        if (!cancelled) setState({ kind: "error", message: `סוג מסמך "${documentType}" אינו נתמך לצפייה` });
        return;
      }

      try {
        const res = await fetch("/api/rivhit/document-copy", {
          method:  "POST",
          headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
          body:    JSON.stringify({ document_type: typeNum, document_number: documentNumber }),
        });

        const data: unknown = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setState({ kind: "error", message: `שגיאת שרת: HTTP ${res.status}` });
          return;
        }

        // Check for Rivhit-level API error
        if (data !== null && typeof data === "object") {
          const rec = data as Record<string, unknown>;
          if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) {
            const msg = typeof rec["client_message"] === "string"
              ? rec["client_message"]
              : `שגיאת Rivhit (${String(rec["error_code"])})`;
            setState({ kind: "error", message: msg });
            return;
          }
        }

        const url = findFirstUrl(data);
        if (url !== null) {
          setState({ kind: "ready", url });
          return;
        }

        setState({ kind: "error", message: "לא נמצא קישור למסמך בתגובת ה-API" });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "שגיאת רשת — לא ניתן להגיע ל-Rivhit" });
      }
    }

    void fetchLink();
    return () => { cancelled = true; };
  }, [documentType, documentNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal panel */}
      <div className="relative flex h-[92vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3" dir="rtl">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span>{documentType}</span>
            <span className="text-gray-300">·</span>
            <span dir="ltr" className="tabular-nums text-gray-600">{documentNumber}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור תצוגת מסמך"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-hidden">

          {state.kind === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
              <svg
                className="h-8 w-8 animate-spin text-indigo-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              <p className="text-sm text-gray-500" dir="rtl">מביא מסמך...</p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-8 text-center" dir="rtl">
              <div className="rounded-full bg-red-100 p-4">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
              </div>
              <p className="max-w-sm text-sm text-gray-700">{state.message}</p>
            </div>
          )}

          {state.kind === "ready" && (
            <iframe
              src={state.url}
              title={`${documentType} ${documentNumber}`}
              className="h-full w-full border-none"
              allow="fullscreen"
            />
          )}
        </div>

        {/* Footer — fallback link, always shown when ready */}
        {state.kind === "ready" && (
          <div className="shrink-0 flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-2" dir="rtl">
            <p className="text-xs text-gray-400">
              אם המסמך אינו מוצג, לחץ על הקישור
            </p>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              פתח במסך חדש ↗
            </a>
          </div>
        )}

      </div>
    </div>
  );
}

// Re-export so table and panel can import the icon without depending on this module's internals
export { EyeIcon };
