"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedRow } from "@/types/collections";
import type { CustomerContact } from "@/types/contacts";
import type { CollectionStatus, CustomerStatus } from "@/types/status";
import { ALL_STATUSES } from "@/types/status";
import type { ActivityEntry, ActivityType } from "@/types/activity";

// ── Invisible-character sanitizer ────────────────────────────────────────────
// Rivhit embeds RTL marks and zero-width chars in strings. trim() misses them
// and they corrupt mailto: URLs. Same set as parseRivhitApi.ts INVIS_RE.
const STRIP_INVIS = /[­​‌‍‎‏﻿]/g;

function stripInvis(s: string): string {
  return s.replace(STRIP_INVIS, "").trim();
}

// ── Document key ─────────────────────────────────────────────────────────────
// Composite key — different document types can share a number, so use all three fields.
function docKey(doc: EnrichedRow): string {
  return `${doc.documentType}|${doc.documentNumber}|${doc.documentDate}`;
}

// ── Formatting ──────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCurrency(n: number): string {
  return "₪ " + ILS.format(n);
}

function fmtEntryTime(ms: number): string {
  return new Date(ms).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── Communication helpers ────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0"))   return "972" + digits.slice(1);
  return digits;
}

// ── Rivhit document link fetching ───────────────────────────────────────────

// Maps the human-readable document type name (from the Rivhit export) to its
// numeric document_type ID used by the Rivhit API. Discovered via Document.TypeList.
const DOC_TYPE_NUM: Readonly<Record<string, number>> = {
  "חשבונית מס":        1,
  "חשבונית מס קבלה":  2,
  "חשבונית מס זיכוי": 3,
  "חשבון חיוב":        8,
};

function readToken(): string {
  try {
    const raw = localStorage.getItem("pure-collections:settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { rivhitApiToken?: string };
    return parsed.rivhitApiToken ?? "";
  } catch {
    return "";
  }
}

// Recursively scans any value in a Rivhit response and returns the first
// http(s) URL string found. Same strategy as the settings page analysis —
// does not rely on a specific field name.
function extractFirstUrl(data: unknown): string | null {
  if (typeof data === "string") return /^https?:\/\//.test(data) ? data : null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractFirstUrl(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (data !== null && typeof data === "object") {
    for (const val of Object.values(data as Record<string, unknown>)) {
      const found = extractFirstUrl(val);
      if (found !== null) return found;
    }
  }
  return null;
}

interface LinkResult {
  link: string | null;
  debug: string;
}

async function fetchDocumentLink(
  token: string,
  documentType: string,
  documentNumber: number,
): Promise<LinkResult> {
  // Trim defensively — Rivhit exports sometimes have trailing whitespace
  const typeKey = documentType.trim();
  const typeNum = DOC_TYPE_NUM[typeKey];
  if (typeNum === undefined) {
    return { link: null, debug: `סוג "${typeKey}" לא ממופה` };
  }
  try {
    const res = await fetch("/api/rivhit/document-list", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
      body: JSON.stringify({
        from_document_type:   typeNum,
        to_document_type:     typeNum,
        from_document_number: documentNumber,
        to_document_number:   documentNumber,
      }),
    });
    if (!res.ok) return { link: null, debug: `HTTP ${res.status}` };
    const data: unknown = await res.json();
    const rec = data as Record<string, unknown>;
    if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) {
      return { link: null, debug: `Rivhit error ${String(rec["error_code"])}: ${String(rec["client_message"] ?? "")}` };
    }
    const link = extractFirstUrl(data);
    return { link, debug: link !== null ? "✓ קישור נמצא" : "✗ אין URL בתגובה" };
  } catch (err) {
    return { link: null, debug: `חריגה: ${String(err)}` };
  }
}

interface LinksResult {
  map:        Map<string, string>;
  debugLines: string[];
  tokenFound: boolean;
}

// Fetches a document_link for each row in parallel. Per-document failures are
// captured in debugLines and do not block the message from sending.
async function fetchDocumentLinks(rows: EnrichedRow[]): Promise<LinksResult> {
  const token = readToken();
  if (!token) {
    return { map: new Map(), debugLines: ["טוקן לא נמצא — בדוק הגדרות"], tokenFound: false };
  }
  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      const result = await fetchDocumentLink(token, row.documentType, row.documentNumber);
      return { key: docKey(row), label: `${row.documentType} ${row.documentNumber}`, ...result };
    }),
  );
  const map = new Map<string, string>();
  const debugLines: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      debugLines.push(`${r.value.label}: ${r.value.debug}`);
      if (r.value.link !== null) map.set(r.value.key, r.value.link);
    } else {
      debugLines.push("שגיאה לא צפויה");
    }
  }
  return { map, debugLines, tokenFound: true };
}

// ── Message builders ─────────────────────────────────────────────────────────

// Builds a WhatsApp draft from the caller-supplied rows (already filtered to selection)
function buildWhatsAppMessage(customerName: string, rows: EnrichedRow[], links: Map<string, string>): string {
  const sorted = [...rows].sort((a, b) => b.ageDays - a.ageDays);
  const total  = rows.reduce((s, r) => s + r.remainingBalance, 0);

  const docLines = sorted.flatMap((r) => {
    const line = `• ${r.documentType} ${r.documentNumber} — ${fmtCurrency(r.remainingBalance)} (${r.ageDays} יום)`;
    const link = links.get(docKey(r));
    return link !== undefined ? [line, `  🔗 ${link}`] : [line];
  });

  return [
    `שלום ${customerName},`,
    ``,
    `ברצוננו להזכירך כי קיימת יתרה פתוחה במערכת:`,
    ``,
    `סכום כולל לתשלום: ${fmtCurrency(total)}`,
    ``,
    `מסמכים פתוחים:`,
    ...docLines,
    ``,
    `נשמח לקבל את תשלומכם בהקדם האפשרי.`,
    ``,
    `תודה,`,
    `PURE WATER ISRAEL`,
  ].join("\n");
}

function buildEmailUrl(email: string, customerName: string, rows: EnrichedRow[], links: Map<string, string>): string {
  const sorted = [...rows].sort((a, b) => b.ageDays - a.ageDays);
  const total  = rows.reduce((s, r) => s + r.remainingBalance, 0);

  const docLines = sorted.flatMap((r) => {
    const line = `${r.documentType} ${r.documentNumber} — ${fmtCurrency(r.remainingBalance)} — ${r.documentDate} — ${r.ageDays} ימים פיגור`;
    const link = links.get(docKey(r));
    return link !== undefined ? [line, `  🔗 ${link}`] : [line];
  });

  const subject = `תזכורת תשלום — ${customerName}`;

  const body = [
    `שלום ${customerName},`,
    ``,
    `להלן פירוט היתרה הפתוחה במערכת:`,
    ``,
    `סכום כולל לתשלום: ${fmtCurrency(total)}`,
    ``,
    `פירוט מסמכים:`,
    ...docLines,
    ``,
    `נבקשך לסדר את התשלום בהקדם האפשרי.`,
    `לפרטים נוספים אנא צור עמנו קשר.`,
    ``,
    `בכבוד רב,`,
    `PURE WATER ISRAEL`,
  ].join("\n");

  // Strip invisible Unicode chars (RTL marks, ZW spaces) that Rivhit embeds in strings
  // and corrupt the mailto: URL even though .trim() misses them.
  const safeEmail = email.replace(STRIP_INVIS, "").trim();
  return `mailto:${safeEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── Styling maps ────────────────────────────────────────────────────────────

const BAND_BADGE: Record<EnrichedRow["band"], string> = {
  fresh:  "bg-gray-100 text-gray-600",
  yellow: "bg-amber-200 text-amber-900",
  red:    "bg-red-200 text-red-900",
};

const CARD_BG: Record<EnrichedRow["band"], string> = {
  fresh:  "bg-white border-gray-200",
  yellow: "bg-amber-50 border-amber-200",
  red:    "bg-red-50 border-red-200",
};

const STATUS_PILL: Record<CollectionStatus, { active: string; inactive: string }> = {
  "לא טופל":      {
    active:   "bg-gray-500 text-white border border-gray-500",
    inactive: "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100",
  },
  "בטיפול":       {
    active:   "bg-blue-500 text-white border border-blue-500",
    inactive: "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100",
  },
  "ממתין לתשלום": {
    active:   "bg-amber-500 text-white border border-amber-500",
    inactive: "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100",
  },
  "מועמד לתשלום": {
    active:   "bg-indigo-500 text-white border border-indigo-500",
    inactive: "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100",
  },
  "שולם":         {
    active:   "bg-green-500 text-white border border-green-500",
    inactive: "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100",
  },
};

const ACTIVITY_ICON: Record<ActivityType, string> = {
  status_changed:  "◎",
  whatsapp_opened: "W",
  email_opened:    "@",
  manual_note:     "•",
};

const ACTIVITY_COLOR: Record<ActivityType, string> = {
  status_changed:  "text-blue-500",
  whatsapp_opened: "text-green-600",
  email_opened:    "text-gray-500",
  manual_note:     "text-amber-500",
};

// ── Props ───────────────────────────────────────────────────────────────────

interface CustomerPanelProps {
  customerRows:       EnrichedRow[];
  clickedRow:         EnrichedRow | null;
  onClose:            () => void;
  contact:            CustomerContact | undefined;
  onSaveContact:      (customerName: string, contact: CustomerContact) => void;
  status:             CustomerStatus | undefined;
  onSaveStatus:       (customerName: string, status: CollectionStatus) => void;
  onSaveExpectedDate: (customerName: string, date: string | undefined) => void;
  activityEntries:    ActivityEntry[];
  onAddActivity:      (customerName: string, type: ActivityType, text: string) => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function CustomerPanel({
  customerRows,
  clickedRow,
  onClose,
  contact,
  onSaveContact,
  status,
  onSaveStatus,
  onSaveExpectedDate,
  activityEntries,
  onAddActivity,
}: CustomerPanelProps) {
  // Close on Escape — only while panel is open
  useEffect(() => {
    if (!clickedRow) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [clickedRow, onClose]);

  // ── Document selection state ───────────────────────────────────────────────
  // Initialized from customerRows on mount. Because CollectionsTable gives this
  // component key={customerName}, it fully remounts on every customer switch, so
  // this initializer always runs fresh — no useEffect reset needed.
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    () => new Set(customerRows.filter((r) => r.ageDays >= 30).map(docKey))
  );

  const customerName = clickedRow?.customerName ?? "";

  // Rows currently checked — passed to message builders
  const selectedRows = useMemo(
    () => customerRows.filter((r) => selectedDocs.has(docKey(r))),
    [customerRows, selectedDocs]
  );

  function toggleDoc(doc: EnrichedRow) {
    const key = docKey(doc);
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelectedDocs(new Set(customerRows.map(docKey)));
  }

  function deselectAll() {
    setSelectedDocs(new Set());
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const totalBalance  = customerRows.reduce((s, r) => s + r.remainingBalance, 0);
  const docCount      = customerRows.length;
  const maxAgeDays    = customerRows.reduce((m, r) => Math.max(m, r.ageDays), 0);
  const balance60plus = customerRows
    .filter((r) => r.band === "red")
    .reduce((s, r) => s + r.remainingBalance, 0);

  const sortedDocs = [...customerRows].sort((a, b) => b.ageDays - a.ageDays);

  return (
    <div
      aria-hidden={clickedRow === null}
      className={[
        "fixed inset-y-0 right-0 z-30 w-[28rem] bg-white",
        "shadow-[-4px_0_32px_rgba(0,0,0,0.10)]",
        "transition-transform duration-200 ease-out",
        clickedRow ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {clickedRow !== null && (
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">לקוח</p>
              <h2 className="mt-0.5 text-base font-bold leading-snug text-gray-900">
                {customerName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור פאנל"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* ── Collection status ────────────────────────────────────────── */}
          <StatusSection
            customerName={customerName}
            status={status}
            onSaveStatus={onSaveStatus}
            onSaveExpectedDate={onSaveExpectedDate}
          />

          {/* ── Contact section ──────────────────────────────────────────── */}
          <ContactSection
            customerName={customerName}
            contact={contact}
            onSaveContact={onSaveContact}
          />

          {/* ── Communication actions ─────────────────────────────────────── */}
          <CommunicationSection
            customerName={customerName}
            selectedRows={selectedRows}
            contact={contact}
            onAddActivity={onAddActivity}
          />

          {/* ── Customer summary ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <SummaryItem label="יתרה כוללת"          value={fmtCurrency(totalBalance)} size="large" />
              <SummaryItem label="מסמכים פתוחים"       value={String(docCount)} />
              <SummaryItem label="זמן חריגה מקסימלי"   value={`${maxAgeDays} יום`} />
              <SummaryItem
                label="יתרה 60+ יום"
                value={balance60plus > 0 ? fmtCurrency(balance60plus) : "—"}
                variant={balance60plus > 0 ? "red" : "neutral"}
              />
            </div>
          </div>

          {/* ── Document list ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {docCount === 1 ? "מסמך פתוח אחד" : `${docCount} מסמכים פתוחים`}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{selectedRows.length} ייכללו</span>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={selectAll}  className="text-blue-600 hover:text-blue-800">בחר הכל</button>
                <button type="button" onClick={deselectAll} className="text-gray-500 hover:text-gray-700">נקה</button>
              </div>
            </div>
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <DocCard
                  key={docKey(doc)}
                  doc={doc}
                  isClicked={doc.documentNumber === clickedRow.documentNumber}
                  isSelected={selectedDocs.has(docKey(doc))}
                  onToggle={() => toggleDoc(doc)}
                />
              ))}
            </div>
          </div>

          {/* ── Activity timeline ────────────────────────────────────────── */}
          <ActivitySection
            customerName={customerName}
            entries={activityEntries}
            onAddActivity={onAddActivity}
          />

        </div>
      )}
    </div>
  );
}

// ── StatusSection ───────────────────────────────────────────────────────────

interface StatusSectionProps {
  customerName:       string;
  status:             CustomerStatus | undefined;
  onSaveStatus:       (customerName: string, status: CollectionStatus) => void;
  onSaveExpectedDate: (customerName: string, date: string | undefined) => void;
}

function StatusSection({ customerName, status, onSaveStatus, onSaveExpectedDate }: StatusSectionProps) {
  const effectiveStatus: CollectionStatus = status?.status ?? "לא טופל";
  const expectedPaymentDate = status?.expectedPaymentDate;

  return (
    <div className="shrink-0 border-b border-gray-200 px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        סטטוס גבייה
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => {
          const isActive = effectiveStatus === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSaveStatus(customerName, s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive ? STATUS_PILL[s].active : STATUS_PILL[s].inactive
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {effectiveStatus === "מועמד לתשלום" && (
        <div className="mt-3 flex items-center gap-3">
          <label className="shrink-0 text-xs text-gray-400">תאריך תשלום צפוי</label>
          <input
            type="date"
            value={expectedPaymentDate ?? ""}
            onChange={(e) => onSaveExpectedDate(customerName, e.target.value || undefined)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

// ── CommunicationSection ────────────────────────────────────────────────────

interface CommunicationSectionProps {
  customerName:  string;
  selectedRows:  EnrichedRow[]; // only the documents checked for inclusion
  contact:       CustomerContact | undefined;
  onAddActivity: (customerName: string, type: ActivityType, text: string) => void;
}

function CommunicationSection({ customerName, selectedRows, contact, onAddActivity }: CommunicationSectionProps) {
  const phone      = contact?.phone;
  const email      = contact?.email;
  const noSelected = selectedRows.length === 0;
  const [busy, setBusy]   = useState(false);
  const [steps, setSteps] = useState<string[] | null>(null);

  // Yields to the event loop so React can flush the latest state update
  // and paint the step to the screen before the next step runs.
  function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function addStep(line: string): void {
    setSteps((prev) => [...(prev ?? []), line]);
  }

  const waDisabled = !phone || noSelected || busy;
  const emDisabled = !email || noSelected || busy;

  // Runs the full link-fetch sequence, painting each step to the UI before
  // proceeding. Returns the map of docKey → URL (empty if anything fails).
  async function fetchLinksWithSteps(): Promise<Map<string, string>> {
    setSteps(["1. מתחיל להביא קישורים..."]);
    await tick();

    // Diagnostic: show exactly what is (or isn't) in localStorage
    const rawStorage = localStorage.getItem("pure-collections:settings");
    if (rawStorage === null) {
      addStep("⚠️ localStorage key 'pure-collections:settings' לא קיים");
    } else {
      try {
        const parsed = JSON.parse(rawStorage) as Record<string, unknown>;
        const hasToken = "rivhitApiToken" in parsed;
        const tokenVal = parsed["rivhitApiToken"];
        const tokenNonEmpty = typeof tokenVal === "string" && tokenVal.length > 0;
        addStep(
          `localStorage נמצא · rivhitApiToken: ${hasToken ? (tokenNonEmpty ? "✓ יש ערך" : "⚠️ ריק") : "⚠️ שדה חסר"}`
        );
      } catch {
        addStep(`⚠️ localStorage קיים אבל לא JSON תקין: ${rawStorage.slice(0, 60)}`);
      }
    }
    await tick();

    const token = readToken();
    if (!token) {
      addStep("⚠️ טוקן לא נמצא — פתח הגדרות, הכנס את הטוקן, לחץ שמור, ונסה שוב");
      await tick();
      return new Map();
    }
    addStep(`2. טוקן נמצא ✓`);
    await tick();

    for (const row of selectedRows) {
      const typeKey = row.documentType.trim();
      const typeNum = DOC_TYPE_NUM[typeKey];
      if (typeNum !== undefined) {
        addStep(`3. קורא ל-/api/rivhit/document-list · סוג ${typeNum} · מסמך ${row.documentNumber}`);
      } else {
        addStep(`3. ⚠️ סוג "${typeKey}" לא ממופה — מדלג`);
      }
    }
    await tick();

    const { map, debugLines } = await fetchDocumentLinks(selectedRows);

    addStep("4. התקבלה תשובה:");
    for (const line of debugLines) addStep(`   ${line}`);
    await tick();

    addStep(`5. נמצאו ${map.size}/${selectedRows.length} קישורים`);
    await tick();

    return map;
  }

  async function handleWhatsApp() {
    if (!phone || noSelected) return;
    setBusy(true);
    const links = await fetchLinksWithSteps();
    const msg = buildWhatsAppMessage(customerName, selectedRows, links);
    addStep(`6. הודעה: ${msg.length} תווים · ${msg.split("\n").length} שורות`);
    addStep(`   תחילת הודעה: ${msg.slice(0, 60).replace(/\n/g, "↵")}`);
    addStep(`   סוף הודעה:   ${msg.slice(-60).replace(/\n/g, "↵")}`);
    await tick();
    addStep("7. פותח WhatsApp...");
    await tick();
    window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    onAddActivity(customerName, "whatsapp_opened", "טיוטת WhatsApp נפתחה");
    setBusy(false);
  }

  async function handleEmail() {
    if (!email || noSelected) return;
    setBusy(true);
    const links = await fetchLinksWithSteps();
    addStep("6. פותח אימייל...");
    await tick();
    window.location.href = buildEmailUrl(email, customerName, selectedRows, links);
    onAddActivity(customerName, "email_opened", "טיוטת אימייל נפתחה");
    setBusy(false);
  }

  return (
    <div className="shrink-0 border-b border-gray-200 px-5 py-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <button
            type="button"
            onClick={() => { void handleWhatsApp(); }}
            disabled={waDisabled}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "מכין קישורים..." : "WhatsApp"}
          </button>
        </div>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => { void handleEmail(); }}
            disabled={emDisabled}
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "מכין קישורים..." : "אימייל"}
          </button>
        </div>
      </div>

      {/* ── Disabled reason hints ─────────────────────────────────────────── */}
      {!busy && (waDisabled || emDisabled) && (
        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
          {waDisabled && (
            <p>
              {noSelected
                ? "לא ניתן לשלוח WhatsApp — יש לבחור לפחות מסמך אחד לשליחה."
                : "לא ניתן לשלוח WhatsApp — לא קיים מספר טלפון ללקוח זה."}
            </p>
          )}
          {emDisabled && (
            <p>
              {noSelected
                ? "לא ניתן לשלוח מייל — יש לבחור לפחות מסמך אחד לשליחה."
                : "לא ניתן לשלוח מייל — לא קיימת כתובת מייל ללקוח זה."}
            </p>
          )}
        </div>
      )}

      {/* ── Link-fetch steps panel ────────────────────────────────────────── */}
      {steps !== null && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-xs text-blue-900">
          {steps.map((s, i) => (
            <p key={i} className="leading-snug">{s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ContactSection ──────────────────────────────────────────────────────────

interface ContactDraft {
  contactPerson: string;
  phone:         string;
  email:         string;
  notes:         string;
}

interface ContactSectionProps {
  customerName:  string;
  contact:       CustomerContact | undefined;
  onSaveContact: (customerName: string, contact: CustomerContact) => void;
}

function ContactSection({ customerName, contact, onSaveContact }: ContactSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>({
    contactPerson: "",
    phone:         "",
    email:         "",
    notes:         "",
  });

  const hasAnyData =
    !!contact?.contactPerson ||
    !!contact?.phone ||
    !!contact?.email ||
    !!contact?.notes;

  function startEdit() {
    setDraft({
      contactPerson: contact?.contactPerson ?? "",
      phone:         contact?.phone ?? "",
      email:         contact?.email ?? "",
      notes:         contact?.notes ?? "",
    });
    setIsEditing(true);
  }

  function handleSave() {
    const saved: CustomerContact = { updatedAt: Date.now() };
    const cp = draft.contactPerson.trim();
    const ph = draft.phone.trim();
    const em = stripInvis(draft.email);
    const no = draft.notes.trim();
    if (cp.length > 0) saved.contactPerson = cp;
    if (ph.length > 0) saved.phone = ph;
    if (em.length > 0) saved.email = em;
    if (no.length > 0) saved.notes = no;
    onSaveContact(customerName, saved);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="shrink-0 border-b border-gray-200 px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">פרטי קשר</p>
        <div className="space-y-3">
          <EditField label="שם איש קשר" value={draft.contactPerson} onChange={(v) => setDraft((d) => ({ ...d, contactPerson: v }))} />
          <EditField label="טלפון"       value={draft.phone}         onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}         type="tel" />
          <EditField label="אימייל"      value={draft.email}         onChange={(v) => setDraft((d) => ({ ...d, email: v }))}         type="email" />
          <div>
            <label className="mb-1 block text-xs text-gray-400">הערות</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              ביטול
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              שמור
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-gray-200 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">פרטי קשר</p>
        <button type="button" onClick={startEdit} className="rounded text-xs text-blue-600 hover:text-blue-800">
          {hasAnyData ? "עריכה" : "+ הוסף"}
        </button>
      </div>
      {hasAnyData ? (
        <dl className="space-y-2">
          {contact?.contactPerson && <ViewRow label="שם איש קשר" value={contact.contactPerson} />}
          {contact?.phone         && <ViewRow label="טלפון"       value={contact.phone} />}
          {contact?.email         && <ViewRow label="אימייל"      value={contact.email} />}
          {contact?.notes         && <ViewRow label="הערות"       value={contact.notes} multiline />}
        </dl>
      ) : (
        <p className="text-sm italic text-gray-400">אין פרטי קשר שמורים</p>
      )}
    </div>
  );
}

// ── ActivitySection ─────────────────────────────────────────────────────────

interface ActivitySectionProps {
  customerName:  string;
  entries:       ActivityEntry[];
  onAddActivity: (customerName: string, type: ActivityType, text: string) => void;
}

function ActivitySection({ customerName, entries, onAddActivity }: ActivitySectionProps) {
  const [note, setNote] = useState("");

  function handleAdd() {
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddActivity(customerName, "manual_note", trimmed);
    setNote("");
  }

  const displayed = [...entries].reverse();

  return (
    <div className="shrink-0 border-t border-gray-200 px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        יומן פעילות
      </p>

      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) handleAdd(); }}
          placeholder="מה קרה?"
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!note.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          הוסף
        </button>
      </div>

      {displayed.length === 0 ? (
        <p className="text-xs italic text-gray-400">אין פעילות מתועדת עדיין</p>
      ) : (
        <div className="max-h-40 space-y-2.5 overflow-y-auto">
          {displayed.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className={`mt-0.5 shrink-0 text-xs font-bold ${ACTIVITY_COLOR[entry.type]}`}>
                  {ACTIVITY_ICON[entry.type]}
                </span>
                <p className="text-xs leading-relaxed text-gray-800">{entry.text}</p>
              </div>
              <time className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                {fmtEntryTime(entry.createdAt)}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function EditField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
      />
    </div>
  );
}

function ViewRow({ label, value, multiline = false }: {
  label: string; value: string; multiline?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className={`text-right font-medium text-gray-900 ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

interface SummaryItemProps {
  label: string; value: string; size?: "large"; variant?: "red" | "neutral";
}

function SummaryItem({ label, value, size, variant }: SummaryItemProps) {
  const valueColor = variant === "red" ? "text-red-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 font-bold tabular-nums ${size === "large" ? "text-base" : "text-sm"} ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

interface DocCardProps {
  doc:        EnrichedRow;
  isClicked:  boolean;
  isSelected: boolean;
  onToggle:   () => void;
}

function DocCard({ doc, isClicked, isSelected, onToggle }: DocCardProps) {
  const cardBg      = isClicked ? "border-blue-300 bg-blue-50" : CARD_BG[doc.band];
  const balanceColor = doc.remainingBalance < 0 ? "text-green-700" : doc.band === "red" ? "text-red-700" : "text-gray-900";

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-[14px] h-4 w-4 shrink-0 accent-indigo-600"
      />
      <div className={`flex-1 rounded-lg border px-4 py-3 transition-opacity ${cardBg} ${!isSelected ? "opacity-40" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-right text-sm font-semibold text-gray-900">
            {doc.documentType}
            <span className="mx-1 text-gray-300">·</span>
            <span className="font-normal tabular-nums text-gray-600">{doc.documentNumber}</span>
          </p>
          <p className={`shrink-0 text-left text-sm font-bold tabular-nums ${balanceColor}`}>
            {fmtCurrency(doc.remainingBalance)}
          </p>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-right text-xs text-gray-500">
            {doc.documentDate}
            {doc.dueDate !== "" && <span className="text-gray-400"> · פרעון: {doc.dueDate}</span>}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_BADGE[doc.band]}`}>
            {doc.ageDays} יום
          </span>
        </div>
      </div>
    </label>
  );
}
