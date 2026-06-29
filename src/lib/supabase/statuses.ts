import { createClient } from "@/lib/supabase/client";
import type { DocumentStatus, StatusMap } from "@/types/status";

// ── Cloud row type (matches document_statuses schema exactly) ─────────────────

interface CloudStatusRow {
  doc_status_key:        string;
  status:                string;
  expected_payment_date: string | null;
  updated_at:            string;
}

// ── Converters ────────────────────────────────────────────────────────────────

function rowsToStatusMap(rows: CloudStatusRow[]): StatusMap {
  const map: StatusMap = {};
  for (const row of rows) {
    map[row.doc_status_key] = {
      status:    row.status as DocumentStatus["status"],
      updatedAt: new Date(row.updated_at).getTime(),
      ...(row.expected_payment_date !== null
        ? { expectedPaymentDate: row.expected_payment_date }
        : {}),
    };
  }
  return map;
}

function statusToRow(
  docKey:   string,
  entry:    DocumentStatus,
  userId:   string,
  tenantId: string,
) {
  return {
    tenant_id:             tenantId,
    doc_status_key:        docKey,
    status:                entry.status,
    expected_payment_date: entry.expectedPaymentDate ?? null,
    updated_at:            new Date(entry.updatedAt).toISOString(),
    updated_by:            userId,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all document statuses for the current tenant from Supabase.
 * RLS restricts results to the authenticated user's tenant automatically.
 * Returns null on any error — caller should fall back to localStorage.
 */
export async function fetchCloudStatuses(): Promise<StatusMap | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("document_statuses")
      .select("doc_status_key, status, expected_payment_date, updated_at");
    if (error || !data) return null;
    return rowsToStatusMap(data as CloudStatusRow[]);
  } catch {
    return null;
  }
}

/**
 * Upsert a single document status to Supabase.
 * Used by both handleSaveStatus and handleSaveExpectedDate — both update the same row.
 * Returns true on success, false on any failure.
 * Caller keeps the localStorage write regardless of the return value.
 */
export async function upsertCloudStatus(
  docKey:   string,
  entry:    DocumentStatus,
  userId:   string,
  tenantId: string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("document_statuses")
      .upsert(statusToRow(docKey, entry, userId, tenantId), {
        onConflict: "tenant_id,doc_status_key",
      });
    return !error;
  } catch {
    return false;
  }
}
