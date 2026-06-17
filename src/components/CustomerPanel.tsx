"use client";

import { useEffect, useState } from "react";
import type { EnrichedRow } from "@/types/collections";
import type { CustomerContact } from "@/types/contacts";

// ── Formatting ──────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCurrency(n: number): string {
  return "₪ " + ILS.format(n);
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

// ── Props ───────────────────────────────────────────────────────────────────

interface CustomerPanelProps {
  customerRows:  EnrichedRow[];
  clickedRow:    EnrichedRow | null;
  onClose:       () => void;
  contact:       CustomerContact | undefined; // undefined = no saved contact
  onSaveContact: (customerName: string, contact: CustomerContact) => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function CustomerPanel({
  customerRows,
  clickedRow,
  onClose,
  contact,
  onSaveContact,
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

  // Customer-level aggregates
  const customerName  = clickedRow?.customerName ?? "";
  const totalBalance  = customerRows.reduce((s, r) => s + r.remainingBalance, 0);
  const docCount      = customerRows.length;
  const maxAgeDays    = customerRows.reduce((m, r) => Math.max(m, r.ageDays), 0);
  const balance60plus = customerRows
    .filter((r) => r.band === "red")
    .reduce((s, r) => s + r.remainingBalance, 0);

  // Documents sorted: most overdue first
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

          {/* ── Contact section ──────────────────────────────────────────── */}
          <ContactSection
            key={customerName}
            customerName={customerName}
            contact={contact}
            onSaveContact={onSaveContact}
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {docCount === 1 ? "מסמך פתוח אחד" : `${docCount} מסמכים פתוחים`}
            </p>
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <DocCard
                  key={doc.documentNumber}
                  doc={doc}
                  isClicked={doc.documentNumber === clickedRow.documentNumber}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── ContactSection ──────────────────────────────────────────────────────────
// key={customerName} is set by the parent so state resets when customer changes

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
    const em = draft.email.trim();
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
          <EditField
            label="שם איש קשר"
            value={draft.contactPerson}
            onChange={(v) => setDraft((d) => ({ ...d, contactPerson: v }))}
          />
          <EditField
            label="טלפון"
            value={draft.phone}
            onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
            type="tel"
          />
          <EditField
            label="אימייל"
            value={draft.email}
            onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
            type="email"
          />
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
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
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
        <button
          type="button"
          onClick={startEdit}
          className="rounded text-xs text-blue-600 hover:text-blue-800"
        >
          {hasAnyData ? "עריכה" : "+ הוסף"}
        </button>
      </div>
      {hasAnyData ? (
        <dl className="space-y-2">
          {contact?.contactPerson && (
            <ViewRow label="שם איש קשר" value={contact.contactPerson} />
          )}
          {contact?.phone && (
            <ViewRow label="טלפון" value={contact.phone} />
          )}
          {contact?.email && (
            <ViewRow label="אימייל" value={contact.email} />
          )}
          {contact?.notes && (
            <ViewRow label="הערות" value={contact.notes} multiline />
          )}
        </dl>
      ) : (
        <p className="text-sm italic text-gray-400">אין פרטי קשר שמורים</p>
      )}
    </div>
  );
}

// ── ContactSection helpers ──────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  type?:    string;
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

function ViewRow({
  label,
  value,
  multiline = false,
}: {
  label:      string;
  value:      string;
  multiline?: boolean;
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

// ── Panel sub-components ────────────────────────────────────────────────────

interface SummaryItemProps {
  label:    string;
  value:    string;
  size?:    "large";
  variant?: "red" | "neutral";
}

function SummaryItem({ label, value, size, variant }: SummaryItemProps) {
  const valueColor = variant === "red" ? "text-red-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`mt-0.5 font-bold tabular-nums ${
          size === "large" ? "text-base" : "text-sm"
        } ${valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}

interface DocCardProps {
  doc:       EnrichedRow;
  isClicked: boolean;
}

function DocCard({ doc, isClicked }: DocCardProps) {
  const cardBg = isClicked ? "border-blue-300 bg-blue-50" : CARD_BG[doc.band];

  const balanceColor =
    doc.remainingBalance < 0
      ? "text-green-700"
      : doc.band === "red"
      ? "text-red-700"
      : "text-gray-900";

  return (
    <div className={`rounded-lg border px-4 py-3 ${cardBg}`}>

      {/* Line 1: document type · number  |  balance */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-right text-sm font-semibold text-gray-900">
          {doc.documentType}
          <span className="mx-1 text-gray-300">·</span>
          <span className="font-normal tabular-nums text-gray-600">
            {doc.documentNumber}
          </span>
        </p>
        <p className={`shrink-0 text-left text-sm font-bold tabular-nums ${balanceColor}`}>
          {fmtCurrency(doc.remainingBalance)}
        </p>
      </div>

      {/* Line 2: dates  |  aging badge */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-right text-xs text-gray-500">
          {doc.documentDate}
          {doc.dueDate !== "" && (
            <span className="text-gray-400"> · פרעון: {doc.dueDate}</span>
          )}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_BADGE[doc.band]}`}
        >
          {doc.ageDays} יום
        </span>
      </div>

    </div>
  );
}
