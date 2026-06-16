"use client";

import { startTransition, useEffect, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";
import { UploadForm } from "@/components/UploadForm";
import { CollectionsTable } from "@/components/CollectionsTable";

const STORAGE_KEY = "pure-collections:report";

interface StoredReport {
  importedAt: number;
  rows: RivhitRow[];
}

type AppState =
  | { mode: "loading" }
  | { mode: "upload"; canCancel: boolean }
  | { mode: "workspace"; rows: RivhitRow[]; importedAt: number };

function readStorage(): StoredReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

function writeStorage(report: StoredReport): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
}

export function AppShell() {
  const [state, setState] = useState<AppState>({ mode: "loading" });

  // Read localStorage after hydration to avoid SSR mismatch.
  // startTransition wraps setState so it lives in a callback, not the direct
  // effect body — satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    const stored = readStorage();
    startTransition(() => {
      setState(
        stored
          ? { mode: "workspace", rows: stored.rows, importedAt: stored.importedAt }
          : { mode: "upload", canCancel: false }
      );
    });
  }, []);

  function handleImport(rows: RivhitRow[]) {
    const importedAt = Date.now();
    writeStorage({ importedAt, rows });
    setState({ mode: "workspace", rows, importedAt });
  }

  // Switch to upload without clearing localStorage —
  // existing data survives until a new import succeeds
  function handleRequestNewImport() {
    setState({ mode: "upload", canCancel: true });
  }

  function handleCancelUpload() {
    const stored = readStorage();
    if (stored) {
      setState({ mode: "workspace", rows: stored.rows, importedAt: stored.importedAt });
    }
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
    />
  );
}
