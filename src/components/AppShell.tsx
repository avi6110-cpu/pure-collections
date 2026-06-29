"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import { docStatusKey } from "@/lib/parseRivhit";
import type { ContactMap, CustomerContact } from "@/types/contacts";
import type { CollectionStatus, DocumentStatus, StatusMap } from "@/types/status";
import type { ActivityLog, ActivityEntry, ActivityType } from "@/types/activity";
import { UploadForm } from "@/components/UploadForm";
import { CollectionsTable } from "@/components/CollectionsTable";
import {
  parseApiResponse,
  extractApiError,
  extractCustomerIds,
  parseCustomerList,
} from "@/lib/parseRivhitApi";
import type { ApiContactFields } from "@/lib/parseRivhitApi";
import type { AppUser } from "@/types/auth";

const REPORT_KEY   = "pure-collections:report";
const CONTACTS_KEY = "pure-collections:contacts";
const STATUSES_KEY = "pure-collections:status";
const ACTIVITY_KEY = "pure-collections:activity";
const SETTINGS_KEY = "pure-collections:settings";

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportSource = "api" | "excel";
type SyncState = "idle" | "loading" | "success" | "error";

export interface SyncStats {
  documents: number;
  contactsWritten: number;
  contactSyncFailed: boolean;
}

interface StoredReport {
  importedAt:   number;
  rows:         RivhitRow[];
  importSource?: ImportSource;
}

type AppState =
  | { mode: "loading" }
  | { mode: "upload"; canCancel: boolean }
  | {
      mode:         "workspace";
      rows:         RivhitRow[];
      importedAt:   number;
      importSource: ImportSource;
      contacts:     ContactMap;
      statuses:     StatusMap;
      activityLog:  ActivityLog;
    };

// ── localStorage helpers ─────────────────────────────────────────────────────

function readReport(): StoredReport | null {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredReport;
  } catch { return null; }
}
function writeReport(report: StoredReport): boolean {
  try {
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    return true;
  } catch { return false; }
}

function readContacts(): ContactMap {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ContactMap;
  } catch { return {}; }
}
function writeContacts(contacts: ContactMap): boolean {
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    return true;
  } catch { return false; }
}

function writeStatuses(statuses: StatusMap): boolean {
  try {
    localStorage.setItem(STATUSES_KEY, JSON.stringify(statuses));
    return true;
  } catch { return false; }
}

function readStatuses(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUSES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const keys = Object.keys(parsed);
    if (keys.length === 0) return {};

    // Detect old customer-level format: no key contains "|"
    const isOldFormat = !keys.some((k) => k.includes("|"));

    if (isOldFormat) {
      // Migrate to document-level by applying each customer's status to all
      // of their documents in the current stored report.
      const report = readReport();
      if (!report || report.rows.length === 0) {
        localStorage.removeItem(STATUSES_KEY);
        return {};
      }

      type OldEntry = { status: CollectionStatus; updatedAt: number; expectedPaymentDate?: string };
      const old = parsed as Record<string, OldEntry>;
      const newStatuses: StatusMap = {};

      for (const row of report.rows) {
        const customerStat = old[row.customerName];
        // "לא טופל" is the default — no need to store it
        if (!customerStat || customerStat.status === "לא טופל") continue;
        const key = docStatusKey(row);
        newStatuses[key] = {
          status:    customerStat.status,
          updatedAt: customerStat.updatedAt,
          ...(customerStat.expectedPaymentDate
            ? { expectedPaymentDate: customerStat.expectedPaymentDate }
            : {}),
        };
      }

      writeStatuses(newStatuses);
      return newStatuses;
    }

    // New document-level format — apply "הבטיח לשלם" rename if present
    const map = parsed as StatusMap;
    let migrated = false;
    for (const key of Object.keys(map)) {
      const entry = map[key];
      if (entry && (entry.status as string) === "הבטיח לשלם") {
        map[key] = { ...entry, status: "ממתין לתשלום" };
        migrated = true;
      }
    }
    if (migrated) writeStatuses(map);
    return map;
  } catch { return {}; }
}

function readActivity(): ActivityLog {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ActivityLog;
  } catch { return {}; }
}
function writeActivity(log: ActivityLog): boolean {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
    return true;
  } catch { return false; }
}

function readToken(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { rivhitApiToken?: string };
    return parsed.rivhitApiToken ?? "";
  } catch { return ""; }
}

// ── Component ────────────────────────────────────────────────────────────────

export function AppShell({ user }: { user: AppUser }) {
  const [state,     setState]     = useState<AppState>({ mode: "loading" });
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [ioError,   setIoError]   = useState<string | null>(null);

  useEffect(() => {
    const stored      = readReport();
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    startTransition(() => {
      setState(
        stored
          ? {
              mode:         "workspace",
              rows:         stored.rows,
              importedAt:   stored.importedAt,
              importSource: stored.importSource ?? "excel",
              contacts,
              statuses,
              activityLog,
            }
          : { mode: "upload", canCancel: false },
      );
    });
  }, []);

  function handleImport(rows: RivhitRow[], source: ImportSource = "excel"): boolean {
    const importedAt = Date.now();
    if (!writeReport({ importedAt, rows, importSource: source })) {
      setIoError("נכשלה שמירת הנתונים — נפח האחסון מלא");
      return false;
    }
    // Contacts, statuses, and activity are NEVER overwritten on import
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    startTransition(() =>
      setState({ mode: "workspace", rows, importedAt, importSource: source, contacts, statuses, activityLog }),
    );
    return true;
  }

  async function handleApiSync() {
    setSyncState("loading");
    setSyncError(null);
    setSyncStats(null);

    const token = readToken();
    if (!token) {
      setSyncState("error");
      setSyncError("טוקן API לא מוגדר — עבור להגדרות");
      return;
    }

    try {
      // ── Step 1: Fetch open documents ────────────────────────────────────
      const docRes = await fetch("/api/rivhit/customer-open-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
        body: JSON.stringify({}),
      });
      const docData: unknown = await docRes.json();

      const rows = parseApiResponse(docData);
      if (rows === null) {
        setSyncState("error");
        setSyncError(extractApiError(docData));
        return;
      }

      // ── Step 2: Extract customer_id → name from raw document response ───
      const customerIdMap = extractCustomerIds(docData);

      // ── Step 3: Fetch Customer.List (failure here must not abort sync) ──
      let contactsWritten = 0;
      let contactSyncFailed = false;

      try {
        const listRes = await fetch("/api/rivhit/customer-list", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
          body: JSON.stringify({}),
        });
        const listData: unknown = await listRes.json();
        const customerListMap = parseCustomerList(listData);

        // ── Step 4: Join by customer_id → Map<customerName, contactFields> ─
        const contactsByName = new Map<string, ApiContactFields>();
        for (const [id, name] of customerIdMap) {
          const fields = customerListMap.get(id);
          if (fields !== undefined) contactsByName.set(name, fields);
        }

        // ── Step 5: Merge into existing contacts (fill-blanks-only) ────────
        const existing = readContacts();
        const merged: ContactMap = { ...existing };

        for (const [name, apiFields] of contactsByName) {
          const cur = merged[name];
          const hasPhone = (cur?.phone ?? "").trim() !== "";
          const hasEmail = (cur?.email ?? "").trim() !== "";
          const fillPhone = !hasPhone && apiFields.phone !== "";
          const fillEmail = !hasEmail && apiFields.email !== "";
          if (fillPhone || fillEmail) {
            merged[name] = {
              ...(cur ?? { updatedAt: 0 }),
              ...(fillPhone ? { phone: apiFields.phone } : {}),
              ...(fillEmail ? { email: apiFields.email } : {}),
              updatedAt: Date.now(),
            };
            contactsWritten++;
          }
        }

        // Write merged contacts BEFORE handleImport so it reads them back
        if (contactsWritten > 0 && !writeContacts(merged)) {
          contactSyncFailed = true;
        }
      } catch {
        contactSyncFailed = true;
      }

      // ── Step 6: Import documents (reads freshly merged contacts) ────────
      if (!handleImport(rows, "api")) return; // storage full — ioError already set
      const stats: SyncStats = { documents: rows.length, contactsWritten, contactSyncFailed };
      setSyncStats(stats);
      setSyncState("success");
      setTimeout(() => setSyncState("idle"), 4000);
    } catch (err) {
      setSyncState("error");
      setSyncError(err instanceof Error ? err.message : "שגיאת רשת");
    }
  }

  function handleRequestNewImport() {
    setState((prev) => {
      if (prev.mode === "loading") return prev;
      return { mode: "upload", canCancel: prev.mode === "workspace" };
    });
  }

  function handleCancelUpload() {
    const stored      = readReport();
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    if (stored) {
      startTransition(() =>
        setState({
          mode:         "workspace",
          rows:         stored.rows,
          importedAt:   stored.importedAt,
          importSource: stored.importSource ?? "excel",
          contacts,
          statuses,
          activityLog,
        }),
      );
    }
  }

  function handleSaveContact(customerName: string, contact: CustomerContact) {
    if (state.mode !== "workspace") return;
    const contacts: ContactMap = { ...state.contacts, [customerName]: contact };
    if (!writeContacts(contacts)) { setIoError("נכשלה שמירת פרטי הקשר — נפח האחסון מלא"); return; }
    setState({ ...state, contacts });
  }

  // docKey format: `${customerName}|${documentType}|${documentNumber}`
  function handleSaveStatus(docKey: string, status: CollectionStatus) {
    if (state.mode !== "workspace") return;

    const prevEntry  = state.statuses[docKey];
    const prevStatus: CollectionStatus = prevEntry?.status ?? "לא טופל";

    const newEntry: DocumentStatus = {
      status,
      updatedAt: Date.now(),
      // B5: only carry expectedPaymentDate forward when staying on "מועמד לתשלום"
      ...(status === "מועמד לתשלום" && prevEntry?.expectedPaymentDate
        ? { expectedPaymentDate: prevEntry.expectedPaymentDate }
        : {}),
    };
    const statuses: StatusMap = { ...state.statuses, [docKey]: newEntry };
    if (!writeStatuses(statuses)) { setIoError("נכשלה שמירת הסטטוס — נפח האחסון מלא"); return; }

    let activityLog = state.activityLog;
    if (prevStatus !== status) {
      // Extract customer name and document label from the key
      const firstPipe  = docKey.indexOf("|");
      const customerName = firstPipe >= 0 ? docKey.slice(0, firstPipe) : docKey;
      const rest       = firstPipe >= 0 ? docKey.slice(firstPipe + 1) : "";
      const lastPipe   = rest.lastIndexOf("|");
      const docType    = lastPipe >= 0 ? rest.slice(0, lastPipe) : rest;
      const docNum     = lastPipe >= 0 ? rest.slice(lastPipe + 1) : "";

      const text  = `${docType} ${docNum}: סטטוס שונה מ"${prevStatus}" ל"${status}"`;
      const entry: ActivityEntry = {
        id: crypto.randomUUID(),
        type: "status_changed",
        text,
        createdAt: Date.now(),
      };
      const existing = activityLog[customerName] ?? [];
      activityLog = { ...activityLog, [customerName]: [...existing, entry] };
      if (!writeActivity(activityLog)) setIoError("נכשלה שמירת יומן הפעילות — נפח האחסון מלא");
    }

    setState({ ...state, statuses, activityLog });
  }

  function handleSaveExpectedDate(docKey: string, date: string | undefined) {
    if (state.mode !== "workspace") return;
    const existing = state.statuses[docKey] ?? { status: "לא טופל" as CollectionStatus, updatedAt: Date.now() };
    const newEntry: DocumentStatus = date
      ? { ...existing, expectedPaymentDate: date }
      : { status: existing.status, updatedAt: existing.updatedAt };
    const statuses: StatusMap = { ...state.statuses, [docKey]: newEntry };
    if (!writeStatuses(statuses)) { setIoError("נכשלה שמירת תאריך התשלום — נפח האחסון מלא"); return; }
    setState({ ...state, statuses });
  }

  function handleAddActivity(customerName: string, type: ActivityType, text: string) {
    if (state.mode !== "workspace") return;
    const entry: ActivityEntry = { id: crypto.randomUUID(), type, text, createdAt: Date.now() };
    const existing = state.activityLog[customerName] ?? [];
    const activityLog: ActivityLog = { ...state.activityLog, [customerName]: [...existing, entry] };
    if (!writeActivity(activityLog)) { setIoError("נכשלה שמירת יומן הפעילות — נפח האחסון מלא"); return; }
    setState({ ...state, activityLog });
  }

  if (state.mode === "loading") return null;

  const storageErrorBanner = ioError !== null && (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-red-600 px-6 py-2.5 text-sm text-white shadow-lg">
      <span>⚠ {ioError}</span>
      <button
        type="button"
        onClick={() => setIoError(null)}
        aria-label="סגור"
        className="shrink-0 opacity-80 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );

  if (state.mode === "upload") {
    return (
      <>
        {storageErrorBanner}
        <UploadForm
          onImport={handleImport}
          onApiSync={() => { void handleApiSync(); }}
          syncState={syncState}
          syncError={syncError}
          {...(state.canCancel ? { onCancel: handleCancelUpload } : {})}
        />
      </>
    );
  }

  return (
    <>
      {storageErrorBanner}
      <CollectionsTable
        user={user}
        rows={state.rows}
        importedAt={state.importedAt}
        importSource={state.importSource}
        onNewImport={handleRequestNewImport}
        onApiSync={() => { void handleApiSync(); }}
        syncState={syncState}
        syncError={syncError}
        syncStats={syncStats}
        contacts={state.contacts}
        onSaveContact={handleSaveContact}
        statuses={state.statuses}
        onSaveStatus={handleSaveStatus}
        onSaveExpectedDate={handleSaveExpectedDate}
        activityLog={state.activityLog}
        onAddActivity={handleAddActivity}
      />
    </>
  );
}
