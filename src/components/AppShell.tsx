"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import type { ContactMap, CustomerContact } from "@/types/contacts";
import type { CollectionStatus, CustomerStatus, StatusMap } from "@/types/status";
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
function writeReport(report: StoredReport): void {
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
}

function readContacts(): ContactMap {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ContactMap;
  } catch { return {}; }
}
function writeContacts(contacts: ContactMap): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function readStatuses(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUSES_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as StatusMap;
    // One-time migration: "הבטיח לשלם" (removed status) → "ממתין לתשלום"
    let migrated = false;
    for (const name of Object.keys(map)) {
      const entry = map[name];
      if (entry && (entry.status as string) === "הבטיח לשלם") {
        map[name] = { ...entry, status: "ממתין לתשלום" };
        migrated = true;
      }
    }
    if (migrated) writeStatuses(map);
    return map;
  } catch { return {}; }
}
function writeStatuses(statuses: StatusMap): void {
  localStorage.setItem(STATUSES_KEY, JSON.stringify(statuses));
}

function readActivity(): ActivityLog {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ActivityLog;
  } catch { return {}; }
}
function writeActivity(log: ActivityLog): void {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
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

export function AppShell() {
  const [state,     setState]     = useState<AppState>({ mode: "loading" });
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

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

  function handleImport(rows: RivhitRow[], source: ImportSource = "excel") {
    const importedAt = Date.now();
    writeReport({ importedAt, rows, importSource: source });
    // Contacts, statuses, and activity are NEVER overwritten on import
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    startTransition(() =>
      setState({ mode: "workspace", rows, importedAt, importSource: source, contacts, statuses, activityLog }),
    );
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
      if (rows.length === 0) {
        setSyncState("error");
        setSyncError("ה-API לא החזיר מסמכים פתוחים");
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
        if (contactsWritten > 0) writeContacts(merged);
      } catch {
        contactSyncFailed = true;
      }

      // ── Step 6: Import documents (reads freshly merged contacts) ────────
      handleImport(rows, "api");
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
    writeContacts(contacts);
    setState({ ...state, contacts });
  }

  function handleSaveStatus(customerName: string, status: CollectionStatus) {
    if (state.mode !== "workspace") return;

    const prevStatus: CollectionStatus = state.statuses[customerName]?.status ?? "לא טופל";
    const newEntry: CustomerStatus = { status, updatedAt: Date.now() };
    const statuses: StatusMap = { ...state.statuses, [customerName]: newEntry };
    writeStatuses(statuses);

    let activityLog = state.activityLog;
    if (prevStatus !== status) {
      const text = `סטטוס שונה מ"${prevStatus}" ל"${status}"`;
      const entry: ActivityEntry = { id: crypto.randomUUID(), type: "status_changed", text, createdAt: Date.now() };
      const existing = activityLog[customerName] ?? [];
      activityLog = { ...activityLog, [customerName]: [...existing, entry] };
      writeActivity(activityLog);
    }

    setState({ ...state, statuses, activityLog });
  }

  function handleSaveExpectedDate(customerName: string, date: string | undefined) {
    if (state.mode !== "workspace") return;
    const existing = state.statuses[customerName];
    if (!existing) return;
    const newEntry: CustomerStatus = date
      ? { ...existing, expectedPaymentDate: date }
      : { status: existing.status, updatedAt: existing.updatedAt };
    const statuses: StatusMap = { ...state.statuses, [customerName]: newEntry };
    writeStatuses(statuses);
    setState({ ...state, statuses });
  }

  function handleAddActivity(customerName: string, type: ActivityType, text: string) {
    if (state.mode !== "workspace") return;
    const entry: ActivityEntry = { id: crypto.randomUUID(), type, text, createdAt: Date.now() };
    const existing = state.activityLog[customerName] ?? [];
    const activityLog: ActivityLog = { ...state.activityLog, [customerName]: [...existing, entry] };
    writeActivity(activityLog);
    setState({ ...state, activityLog });
  }

  if (state.mode === "loading") return null;

  if (state.mode === "upload") {
    return (
      <UploadForm
        onImport={handleImport}
        onApiSync={() => { void handleApiSync(); }}
        syncState={syncState}
        syncError={syncError}
        {...(state.canCancel ? { onCancel: handleCancelUpload } : {})}
      />
    );
  }

  return (
    <CollectionsTable
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
  );
}
