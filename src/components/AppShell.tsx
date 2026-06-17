"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import type { ContactMap, CustomerContact } from "@/types/contacts";
import type { CollectionStatus, CustomerStatus, StatusMap } from "@/types/status";
import { UploadForm } from "@/components/UploadForm";
import { CollectionsTable } from "@/components/CollectionsTable";

const REPORT_KEY   = "pure-collections:report";
const CONTACTS_KEY = "pure-collections:contacts";
const STATUSES_KEY = "pure-collections:status";

interface StoredReport {
  importedAt: number;
  rows: RivhitRow[];
}

type AppState =
  | { mode: "loading" }
  | { mode: "upload"; canCancel: boolean }
  | { mode: "workspace"; rows: RivhitRow[]; importedAt: number; contacts: ContactMap; statuses: StatusMap };

function readReport(): StoredReport | null {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

function writeReport(report: StoredReport): void {
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
}

function readContacts(): ContactMap {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ContactMap;
  } catch {
    return {};
  }
}

function writeContacts(contacts: ContactMap): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function readStatuses(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUSES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StatusMap;
  } catch {
    return {};
  }
}

function writeStatuses(statuses: StatusMap): void {
  localStorage.setItem(STATUSES_KEY, JSON.stringify(statuses));
}

export function AppShell() {
  const [state, setState] = useState<AppState>({ mode: "loading" });

  // Read localStorage after hydration to avoid SSR mismatch.
  // startTransition wraps setState so it lives in a callback, not the direct
  // effect body — satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    const stored   = readReport();
    const contacts = readContacts();
    const statuses = readStatuses();
    startTransition(() => {
      setState(
        stored
          ? { mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts, statuses }
          : { mode: "upload", canCancel: false }
      );
    });
  }, []);

  function handleImport(rows: RivhitRow[]) {
    const importedAt = Date.now();
    writeReport({ importedAt, rows });
    // Contacts and statuses are NEVER overwritten on import — read fresh from storage
    const contacts = readContacts();
    const statuses = readStatuses();
    setState({ mode: "workspace", rows, importedAt, contacts, statuses });
  }

  // Switch to upload without clearing localStorage —
  // existing data survives until a new import succeeds
  function handleRequestNewImport() {
    setState({ mode: "upload", canCancel: true });
  }

  function handleCancelUpload() {
    const stored   = readReport();
    const contacts = readContacts();
    const statuses = readStatuses();
    if (stored) {
      setState({ mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts, statuses });
    }
  }

  function handleSaveContact(customerName: string, contact: CustomerContact) {
    if (state.mode !== "workspace") return;
    const contacts: ContactMap = { ...state.contacts, [customerName]: contact };
    writeContacts(contacts);
    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts, statuses: state.statuses });
  }

  function handleSaveStatus(customerName: string, status: CollectionStatus) {
    if (state.mode !== "workspace") return;
    const newEntry: CustomerStatus = { status, updatedAt: Date.now() };
    const statuses: StatusMap = { ...state.statuses, [customerName]: newEntry };
    writeStatuses(statuses);
    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts: state.contacts, statuses });
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
    />
  );
}
