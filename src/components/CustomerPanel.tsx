"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedRow } from "@/types/collections";
import { docStatusKey } from "@/lib/parseRivhit";
import type { CustomerContact } from "@/types/contacts";
import type { CollectionStatus, DocumentStatus, StatusMap } from "@/types/status";
import { ALL_STATUSES } from "@/types/status";
import type { ActivityEntry, ActivityType } from "@/types/activity";
import { EyeIcon } from "@/components/DocumentPreviewModal";
import { DOC_TYPE_NUM } from "@/lib/parseRivhitApi";

// ── Invisible-character sanitizer ────────────────────────────────────────────
// Rivhit embeds RTL marks and zero-width chars in strings. trim() misses them
// and they corrupt mailto: URLs. Same set as parseRivhitApi.ts INVIS_RE.
const STRIP_INVIS = /[­​‌‍‎‏﻿]/g;

function stripInvis(s: string): string {
  return s.replace(STRIP_INVIS, "").trim();
}

// ── Document key for checkbox set (includes date for uniqueness within panel) ─
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

interface LinkResult { link: string | null; debug: string }

async function fetchDocumentLink(
  token: string,
  documentType: string,
  documentNumber: number,
): Promise<LinkResult> {
  const typeKey = documentType.trim();
  const typeNum = DOC_TYPE_NUM[typeKey];
  if (typeNum === undefined) return { link: null, debug: `סוג "${typeKey}" לא ממופה` };
  try {
    const res = await fetch("/api/rivhit/document-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
      body: JSON.stringify({
        document_type:   typeNum,
        document_number: documentNumber,
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

async function fetchDocumentLinks(rows: EnrichedRow[]): Promise<{ map: Map<string, string>; debugLines: string[]; tokenFound: boolean }> {
  const token = readToken();
  if (!token) return { map: new Map(), debugLines: ["טוקן לא נמצא — בדוק הגדרות"], tokenFound: false };
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
  "לא טופל":      { active: "bg-gray-500 text-white border border-gray-500",     inactive: "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"     },
  "בטיפול":       { active: "bg-blue-500 text-white border border-blue-500",      inactive: "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"      },
  "ממתין לתשלום": { active: "bg-amber-500 text-white border border-amber-500",    inactive: "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100"   },
  "מועמד לתשלום": { active: "bg-indigo-500 text-white border border-indigo-500",  inactive: "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100" },
  "שולם":         { active: "bg-green-500 text-white border border-green-500",    inactive: "bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"   },
};

const ACTIVITY_ICON: Record<ActivityType, string>  = { status_changed: "◎", whatsapp_opened: "W", email_opened: "@", manual_note: "•" };
const ACTIVITY_COLOR: Record<ActivityType, string> = { status_changed: "text-blue-500", whatsapp_opened: "text-green-600", email_opened: "text-gray-500", manual_note: "text-amber-500" };

// ── Props ───────────────────────────────────────────────────────────────────

interface CustomerPanelProps {
  customerRows:       EnrichedRow[];
  clickedRow:         EnrichedRow | null;
  onClose:            () => void;
  contact:            CustomerContact | undefined;
  onSaveContact:      (customerName: string, contact: CustomerContact) => void;
  statuses:           StatusMap;
  onSaveStatus:       (docKey: string, status: CollectionStatus) => void;
  onSaveExpectedDate: (docKey: string, date: string | undefined) => void;
  activityEntries:    ActivityEntry[];
  onAddActivity:      (customerName: string, type: ActivityType, text: string) => void;
  onPreview:          (documentType: string, documentNumber: number) => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function CustomerPanel({
  customerRows,
  clickedRow,
  onClose,
  contact,
  onSaveContact,
  statuses,
  onSaveStatus,
  onSaveExpectedDate,
  activityEntries,
  onAddActivity,
  onPreview,
}: CustomerPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!clickedRow) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [clickedRow, onClose]);

  // ── Document selection — unchanged business logic ──────────────────────────
  // "שולם" docs excluded from initial selection; CustomerPanel remounts on
  // customer switch (key={customerName} in CollectionsTable), so this initializer
  // always runs fresh.
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    () => new Set(
      customerRows
        .filter((r) => r.ageDays >= 30 && statuses[docStatusKey(r)]?.status !== "שולם")
        .map(docKey)
    )
  );

  const customerName = clickedRow?.customerName ?? "";

  const selectedRows = useMemo(
    () => customerRows.filter((r) => selectedDocs.has(docKey(r))),
    [customerRows, selectedDocs]
  );

  function toggleDoc(doc: EnrichedRow) {
    if (statuses[docStatusKey(doc)]?.status === "שולם") return;
    const key = docKey(doc);
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelectedDocs(new Set(
      customerRows.filter((r) => statuses[docStatusKey(r)]?.status !== "שולם").map(docKey)
    ));
  }

  function deselectAll() { setSelectedDocs(new Set()); }

  // When a doc's status becomes "שולם", drop it from the selection immediately
  useEffect(() => {
    setSelectedDocs((prev) => {
      const paidKeys = customerRows
        .filter((r) => prev.has(docKey(r)) && statuses[docStatusKey(r)]?.status === "שולם")
        .map(docKey);
      if (paidKeys.length === 0) return prev;
      const next = new Set(prev);
      paidKeys.forEach((k) => next.delete(k));
      return next;
    });
  }, [statuses, customerRows]);

  // ── Derived values ────────────────────────────────────────────────────────

  const activeDocs = customerRows.filter((r) => statuses[docStatusKey(r)]?.status !== "שולם");
  const paidDocs   = customerRows.filter((r) => statuses[docStatusKey(r)]?.status === "שולם");

  const totalBalance  = activeDocs.reduce((s, r) => s + r.remainingBalance, 0);
  const docCount      = activeDocs.length;
  const maxAgeDays    = activeDocs.reduce((m, r) => Math.max(m, r.ageDays), 0);
  const balance60plus = activeDocs.filter((r) => r.band === "red").reduce((s, r) => s + r.remainingBalance, 0);

  // Active docs first (by age desc), then paid docs at bottom
  const sortedDocs = useMemo(() => {
    const byAge = (a: EnrichedRow, b: EnrichedRow) => b.ageDays - a.ageDays;
    return [...activeDocs.slice().sort(byAge), ...paidDocs.slice().sort(byAge)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerRows, statuses]);

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

          {/* ── 1. Compact header: name + contact inline ─────────────────── */}
          <CompactHeader
            customerName={customerName}
            contact={contact}
            onSaveContact={onSaveContact}
            onClose={onClose}
          />

          {/* ── 2. Document list — primary visual section ─────────────────── */}
          <div className="flex-1 overflow-y-auto border-b border-gray-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {customerRows.length === 1 ? "מסמך פתוח אחד" : `${customerRows.length} מסמכים`}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{selectedRows.length} ייכללו</span>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={selectAll}   className="text-blue-600 hover:text-blue-800">בחר הכל</button>
                <button type="button" onClick={deselectAll} className="text-gray-500 hover:text-gray-700">נקה</button>
              </div>
            </div>
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <DocCard
                  key={docKey(doc)}
                  doc={doc}
                  isClicked={
                    doc.documentNumber === clickedRow.documentNumber &&
                    doc.documentType   === clickedRow.documentType
                  }
                  isSelected={selectedDocs.has(docKey(doc))}
                  onToggle={() => toggleDoc(doc)}
                  docStatus={statuses[docStatusKey(doc)]}
                  onSaveStatus={onSaveStatus}
                  onSaveExpectedDate={onSaveExpectedDate}
                  onPreview={onPreview}
                />
              ))}
            </div>
          </div>

          {/* ── 3. Actions: WhatsApp + email ──────────────────────────────── */}
          <CommunicationSection
            customerName={customerName}
            selectedRows={selectedRows}
            contact={contact}
            onAddActivity={onAddActivity}
          />

          {/* ── 4. Summary strip — compact horizontal row ─────────────────── */}
          <SummaryStrip
            totalBalance={totalBalance}
            docCount={docCount}
            paidCount={paidDocs.length}
            maxAgeDays={maxAgeDays}
            balance60plus={balance60plus}
          />

          {/* ── 5. Activity log ───────────────────────────────────────────── */}
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

// ── CompactHeader ───────────────────────────────────────────────────────────
// Combines the old separate Header and ContactSection into one compact block.
// View mode: customer name + inline contact summary + edit link.
// Edit mode: inline form replaces the header content.

interface ContactDraft { contactPerson: string; phone: string; email: string; notes: string }

interface CompactHeaderProps {
  customerName:  string;
  contact:       CustomerContact | undefined;
  onSaveContact: (customerName: string, contact: CustomerContact) => void;
  onClose:       () => void;
}

function CompactHeader({ customerName, contact, onSaveContact, onClose }: CompactHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>({ contactPerson: "", phone: "", email: "", notes: "" });

  const hasContact = !!(contact?.contactPerson || contact?.phone || contact?.email);

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
      <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">עריכת פרטי קשר</p>
          <button type="button" onClick={() => setIsEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">ביטול</button>
        </div>
        <div className="space-y-2.5">
          <EditField label="שם איש קשר" value={draft.contactPerson} onChange={(v) => setDraft((d) => ({ ...d, contactPerson: v }))} />
          <EditField label="טלפון"       value={draft.phone}         onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}         type="tel" />
          <EditField label="אימייל"      value={draft.email}         onChange={(v) => setDraft((d) => ({ ...d, email: v }))}         type="email" />
          <div>
            <label className="mb-1 block text-xs text-gray-400">הערות</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              ביטול
            </button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              שמור
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-3">
      <div className="flex items-start gap-3">
        {/* Left: name + contact details */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">לקוח</p>
          <h2 className="mt-0.5 truncate text-base font-bold text-gray-900">{customerName}</h2>
          {hasContact ? (
            <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
              {contact?.contactPerson && (
                <p className="font-medium text-gray-700">{contact.contactPerson}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {contact?.phone && <p dir="ltr">{contact.phone}</p>}
                {contact?.email && <p className="truncate">{contact.email}</p>}
              </div>
              {contact?.notes && (
                <p className="line-clamp-1 text-gray-400">{contact.notes}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="mt-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              + הוסף פרטי קשר
            </button>
          )}
        </div>

        {/* Right: edit + close */}
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {hasContact && (
            <button
              type="button"
              onClick={startEdit}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              עריכה
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור פאנל"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SummaryStrip ────────────────────────────────────────────────────────────
// Compact single-row strip replacing the old 2×2 grid.

interface SummaryStripProps {
  totalBalance:  number;
  docCount:      number;
  paidCount:     number;
  maxAgeDays:    number;
  balance60plus: number;
}

function SummaryStrip({ totalBalance, docCount, paidCount, maxAgeDays, balance60plus }: SummaryStripProps) {
  const docsValue = paidCount > 0 ? `${docCount} + ${paidCount}✓` : String(docCount);
  return (
    <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        <StatChip label="יתרה פעילה"   value={fmtCurrency(totalBalance)} emphasis />
        <StatChip label="מסמכים"        value={docsValue} />
        <StatChip label="פיגור מרבי"   value={`${maxAgeDays} יום`} />
        <StatChip label="60+ יום"       value={balance60plus > 0 ? fmtCurrency(balance60plus) : "—"} danger={balance60plus > 0} />
      </div>
    </div>
  );
}

function StatChip({ label, value, emphasis = false, danger = false }: {
  label: string; value: string; emphasis?: boolean; danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-center">
      <p className="text-[9px] leading-tight text-gray-400">{label}</p>
      <p className={[
        "mt-0.5 truncate text-[11px] leading-tight tabular-nums",
        emphasis ? "font-bold text-gray-900" : "font-semibold text-gray-700",
        danger   ? "text-red-700" : "",
      ].filter(Boolean).join(" ")}>
        {value}
      </p>
    </div>
  );
}

// ── CommunicationSection ────────────────────────────────────────────────────

interface CommunicationSectionProps {
  customerName:  string;
  selectedRows:  EnrichedRow[];
  contact:       CustomerContact | undefined;
  onAddActivity: (customerName: string, type: ActivityType, text: string) => void;
}

function CommunicationSection({ customerName, selectedRows, contact, onAddActivity }: CommunicationSectionProps) {
  const phone      = contact?.phone;
  const email      = contact?.email;
  const noSelected = selectedRows.length === 0;
  const [busy,       setBusy]       = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  const waDisabled = !phone || noSelected || busy;
  const emDisabled = !email || noSelected || busy;

  async function fetchLinks(): Promise<Map<string, string>> {
    const token = readToken();
    if (!token) {
      setLinksError("טוקן API לא מוגדר — בדוק הגדרות");
      return new Map();
    }
    setLinksError(null);
    const { map } = await fetchDocumentLinks(selectedRows);
    return map;
  }

  async function handleWhatsApp() {
    if (!phone || noSelected) return;
    setBusy(true);
    const links = await fetchLinks();
    const msg = buildWhatsAppMessage(customerName, selectedRows, links);
    window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    onAddActivity(customerName, "whatsapp_opened", "טיוטת WhatsApp נפתחה");
    setBusy(false);
  }

  async function handleEmail() {
    if (!email || noSelected) return;
    setBusy(true);
    const links = await fetchLinks();
    window.location.href = buildEmailUrl(email, customerName, selectedRows, links);
    onAddActivity(customerName, "email_opened", "טיוטת אימייל נפתחה");
    setBusy(false);
  }

  return (
    <div className="shrink-0 border-t border-gray-200 px-5 py-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { void handleWhatsApp(); }}
          disabled={waDisabled}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "מכין קישורים..." : "WhatsApp"}
        </button>
        <button
          type="button"
          onClick={() => { void handleEmail(); }}
          disabled={emDisabled}
          className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "מכין קישורים..." : "אימייל"}
        </button>
      </div>

      {!busy && (waDisabled || emDisabled) && (
        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
          {waDisabled && (
            <p>{noSelected ? "לא ניתן לשלוח WhatsApp — יש לבחור לפחות מסמך אחד לשליחה." : "לא ניתן לשלוח WhatsApp — לא קיים מספר טלפון ללקוח זה."}</p>
          )}
          {emDisabled && (
            <p>{noSelected ? "לא ניתן לשלוח מייל — יש לבחור לפחות מסמך אחד לשליחה." : "לא ניתן לשלוח מייל — לא קיימת כתובת מייל ללקוח זה."}</p>
          )}
        </div>
      )}

      {linksError !== null && (
        <p className="mt-2 text-xs text-red-600">{linksError}</p>
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
    <div className="shrink-0 border-t border-gray-200 px-5 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">יומן פעילות</p>
      <div className="flex gap-2">
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
        <p className="mt-2 text-xs italic text-gray-400">אין פעילות מתועדת עדיין</p>
      ) : (
        <div className="mt-2 max-h-32 space-y-2 overflow-y-auto">
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

// ── DocCard ─────────────────────────────────────────────────────────────────

interface DocCardProps {
  doc:                EnrichedRow;
  isClicked:          boolean;
  isSelected:         boolean;
  onToggle:           () => void;
  docStatus:          DocumentStatus | undefined;
  onSaveStatus:       (docKey: string, status: CollectionStatus) => void;
  onSaveExpectedDate: (docKey: string, date: string | undefined) => void;
  onPreview:          (documentType: string, documentNumber: number) => void;
}

function DocCard({ doc, isClicked, isSelected, onToggle, docStatus, onSaveStatus, onSaveExpectedDate, onPreview }: DocCardProps) {
  const [statusOpen, setStatusOpen] = useState(false);

  const effectiveStatus: CollectionStatus = docStatus?.status ?? "לא טופל";
  const isPaid    = effectiveStatus === "שולם";
  const statusKey = docStatusKey(doc);

  const cardBg =
    isClicked ? "border-blue-300 bg-blue-50" :
    isPaid    ? "bg-green-50 border-green-200" :
    CARD_BG[doc.band];

  const balanceColor =
    doc.remainingBalance < 0 ? "text-green-700" :
    isPaid               ? "text-green-700" :
    doc.band === "red"   ? "text-red-700"   :
    "text-gray-900";

  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={isPaid}
        className="mt-[14px] h-4 w-4 shrink-0 accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {/* Clicking the card body toggles selection; paid docs are non-interactive */}
      <div
        className={`flex-1 rounded-lg border px-4 py-3 transition-opacity ${cardBg} ${!isPaid ? "cursor-pointer" : ""} ${!isSelected && !isPaid ? "opacity-40" : ""}`}
        onClick={isPaid ? undefined : onToggle}
      >
        {/* Row 1: document type + number + eye button | balance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-right text-sm font-semibold text-gray-900">
              {doc.documentType}
              <span className="mx-1 text-gray-300">·</span>
              <span className="font-normal tabular-nums text-gray-600">{doc.documentNumber}</span>
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPreview(doc.documentType, doc.documentNumber); }}
              aria-label={`צפה במסמך ${doc.documentNumber}`}
              className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-white/70 hover:text-indigo-600"
            >
              <EyeIcon size={13} />
            </button>
          </div>
          <p className={`shrink-0 text-left text-sm font-bold tabular-nums ${balanceColor}`}>
            {fmtCurrency(doc.remainingBalance)}
          </p>
        </div>

        {/* Row 2: date + due date | age badge */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-right text-xs text-gray-500">
            {doc.documentDate}
            {doc.dueDate !== "" && <span className="text-gray-400"> · פרעון: {doc.dueDate}</span>}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_BADGE[doc.band]}`}>
            {doc.ageDays} יום
          </span>
        </div>

        {/* Row 3: per-document status picker */}
        <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
          {statusOpen ? (
            <div className="flex flex-wrap items-center gap-1">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onSaveStatus(statusKey, s); setStatusOpen(false); }}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    s === effectiveStatus ? STATUS_PILL[s].active : STATUS_PILL[s].inactive
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                className="rounded-full px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStatusOpen(true)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[effectiveStatus].active}`}
            >
              {effectiveStatus} ▾
            </button>
          )}

          {/* Expected payment date — only when "מועמד לתשלום" and picker closed */}
          {effectiveStatus === "מועמד לתשלום" && !statusOpen && (
            <div className="mt-2 flex items-center gap-2">
              <label className="shrink-0 text-xs text-gray-400">תאריך תשלום צפוי</label>
              <input
                type="date"
                value={docStatus?.expectedPaymentDate ?? ""}
                onChange={(e) => onSaveExpectedDate(statusKey, e.target.value || undefined)}
                className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
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
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
