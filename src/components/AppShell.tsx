"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import type { ContactMap, CustomerContact } from "@/types/contacts";
import type { CollectionStatus, CustomerStatus, StatusMap } from "@/types/status";
import type { ActivityLog, ActivityEntry, ActivityType } from "@/types/activity";
import { UploadForm } from "@/components/UploadForm";
import { CollectionsTable } from "@/components/CollectionsTable";

const REPORT_KEY   = "pure-collections:report";
const CONTACTS_KEY = "pure-collections:contacts";
const STATUSES_KEY = "pure-collections:status";
const ACTIVITY_KEY = "pure-collections:activity";

interface StoredReport {
  importedAt: number;
  rows: RivhitRow[];
}

type AppState =
  | { mode: "loading" }
  | { mode: "upload"; canCancel: boolean }
  | {
      mode:        "workspace";
      rows:        RivhitRow[];
      importedAt:  number;
      contacts:    ContactMap;
      statuses:    StatusMap;
      activityLog: ActivityLog;
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
    return JSON.parse(raw) as StatusMap;
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

// ── Component ────────────────────────────────────────────────────────────────

export function AppShell() {
  const [state, setState] = useState<AppState>({ mode: "loading" });

  // Read all localStorage keys after hydration to avoid SSR mismatch.
  // startTransition wraps setState so it lives in a callback, not the direct
  // effect body — satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    const stored      = readReport();
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    startTransition(() => {
      setState(
        stored
          ? { mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts, statuses, activityLog }
          : { mode: "upload", canCancel: false }
      );
    });
  }, []);

  function handleImport(rows: RivhitRow[]) {
    const importedAt  = Date.now();
    writeReport({ importedAt, rows });
    // Contacts, statuses, and activity are NEVER overwritten on import
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    setState({ mode: "workspace", rows, importedAt, contacts, statuses, activityLog });
  }

  function handleRequestNewImport() {
    setState({ mode: "upload", canCancel: true });
  }

  function handleCancelUpload() {
    const stored      = readReport();
    const contacts    = readContacts();
    const statuses    = readStatuses();
    const activityLog = readActivity();
    if (stored) {
      setState({ mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts, statuses, activityLog });
    }
  }

  function handleSaveContact(customerName: string, contact: CustomerContact) {
    if (state.mode !== "workspace") return;
    const contacts: ContactMap = { ...state.contacts, [customerName]: contact };
    writeContacts(contacts);
    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts, statuses: state.statuses, activityLog: state.activityLog });
  }

  function handleSaveStatus(customerName: string, status: CollectionStatus) {
    if (state.mode !== "workspace") return;

    // Treat missing entry as the implicit default "לא טופל"
    const prevStatus  = state.statuses[customerName]?.status;
    const fromStatus: CollectionStatus = prevStatus ?? "לא טופל";

    const newEntry: CustomerStatus = { status, updatedAt: Date.now() };
    const statuses: StatusMap = { ...state.statuses, [customerName]: newEntry };
    writeStatuses(statuses);

    // Inline activity entry — single setState avoids stale-closure conflicts
    let activityLog = state.activityLog;
    if (fromStatus !== status) {
      const text = `סטטוס שונה מ"${fromStatus}" ל"${status}"`;
      const entry: ActivityEntry = { id: crypto.randomUUID(), type: "status_changed", text, createdAt: Date.now() };
      const existing = activityLog[customerName] ?? [];
      activityLog = { ...activityLog, [customerName]: [...existing, entry] };
      writeActivity(activityLog);
    }

    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts: state.contacts, statuses, activityLog });
  }

  function handleAddActivity(customerName: string, type: ActivityType, text: string) {
    if (state.mode !== "workspace") return;
    const entry: ActivityEntry = { id: crypto.randomUUID(), type, text, createdAt: Date.now() };
    const existing = state.activityLog[customerName] ?? [];
    const activityLog: ActivityLog = { ...state.activityLog, [customerName]: [...existing, entry] };
    writeActivity(activityLog);
    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts: state.contacts, statuses: state.statuses, activityLog });
  }

  if (state.mode === "loading") return null;

  if (state.mode === "upload") {
    return (
      <UploadForm
        onImport={handleImport}
        {...(state.canCancel ? { onCancel: handleCancelUpload } : {})}
      />
    );
  }

  return (
    <CollectionsTable
      rows={state.rows}
      importedAt={state.importedAt}
      onNewImport={handleRequestNewImport}
      contacts={state.contacts}
      onSaveContact={handleSaveContact}
      statuses={state.statuses}
      onSaveStatus={handleSaveStatus}
      activityLog={state.activityLog}
      onAddActivity={handleAddActivity}
    />
  );
}
