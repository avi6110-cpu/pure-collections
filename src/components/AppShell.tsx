"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import type { ContactMap, CustomerContact } from "@/types/contacts";
import { UploadForm } from "@/components/UploadForm";
import { CollectionsTable } from "@/components/CollectionsTable";

const REPORT_KEY   = "pure-collections:report";
const CONTACTS_KEY = "pure-collections:contacts";

interface StoredReport {
  importedAt: number;
  rows: RivhitRow[];
}

type AppState =
  | { mode: "loading" }
  | { mode: "upload"; canCancel: boolean }
  | { mode: "workspace"; rows: RivhitRow[]; importedAt: number; contacts: ContactMap };

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

export function AppShell() {
  const [state, setState] = useState<AppState>({ mode: "loading" });

  // Read localStorage after hydration to avoid SSR mismatch.
  // startTransition wraps setState so it lives in a callback, not the direct
  // effect body — satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    const stored   = readReport();
    const contacts = readContacts();
    startTransition(() => {
      setState(
        stored
          ? { mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts }
          : { mode: "upload", canCancel: false }
      );
    });
  }, []);

  function handleImport(rows: RivhitRow[]) {
    const importedAt = Date.now();
    writeReport({ importedAt, rows });
    // Contacts are NEVER overwritten on import — read fresh from storage
    const contacts = readContacts();
    setState({ mode: "workspace", rows, importedAt, contacts });
  }

  // Switch to upload without clearing localStorage —
  // existing data survives until a new import succeeds
  function handleRequestNewImport() {
    setState({ mode: "upload", canCancel: true });
  }

  function handleCancelUpload() {
    const stored   = readReport();
    const contacts = readContacts();
    if (stored) {
      setState({ mode: "workspace", rows: stored.rows, importedAt: stored.importedAt, contacts });
    }
  }

  function handleSaveContact(customerName: string, contact: CustomerContact) {
    if (state.mode !== "workspace") return;
    const contacts: ContactMap = { ...state.contacts, [customerName]: contact };
    writeContacts(contacts);
    setState({ mode: "workspace", rows: state.rows, importedAt: state.importedAt, contacts });
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
    />
  );
}
