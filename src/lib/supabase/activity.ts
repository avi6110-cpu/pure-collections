import { createClient } from "@/lib/supabase/client";
import type { ActivityEntry, ActivityLog } from "@/types/activity";

// ── Cloud row type (matches activity_log schema exactly) ──────────────────────

interface CloudActivityRow {
  id:            string;
  customer_name: string;
  activity_type: string;
  text:          string;
  created_at:    string;
}

// ── Converters ────────────────────────────────────────────────────────────────

function rowsToActivityLog(rows: CloudActivityRow[]): ActivityLog {
  const log: ActivityLog = {};
  for (const row of rows) {
    const entry: ActivityEntry = {
      id:        row.id,
      type:      row.activity_type as ActivityEntry["type"],
      text:      row.text,
      createdAt: new Date(row.created_at).getTime(),
    };
    const existing = log[row.customer_name] ?? [];
    log[row.customer_name] = [...existing, entry];
  }
  return log;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all activity log entries for the current tenant from Supabase,
 * sorted oldest-first to match the localStorage append order.
 * Returns null on any error — caller falls back to localStorage.
 */
export async function fetchCloudActivity(): Promise<ActivityLog | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, customer_name, activity_type, text, created_at")
      .order("created_at", { ascending: true });
    if (error || !data) return null;
    return rowsToActivityLog(data as CloudActivityRow[]);
  } catch {
    return null;
  }
}

/**
 * Insert a single activity entry to Supabase.
 * Uses ON CONFLICT (id) DO NOTHING — safe to call on retry; no duplicates.
 * Returns true on success, false on any failure.
 * Caller keeps the localStorage write regardless of the return value.
 */
export async function insertCloudActivity(
  customerName: string,
  entry:         ActivityEntry,
  docStatusKey:  string | null,
  userId:        string,
  tenantId:      string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("activity_log")
      .upsert(
        {
          id:             entry.id,
          tenant_id:      tenantId,
          customer_name:  customerName,
          doc_status_key: docStatusKey,
          activity_type:  entry.type,
          text:           entry.text,
          created_at:     new Date(entry.createdAt).toISOString(),
          created_by:     userId,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    return !error;
  } catch {
    return false;
  }
}
