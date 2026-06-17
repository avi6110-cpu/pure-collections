export type ActivityType =
  | "status_changed"
  | "whatsapp_opened"
  | "email_opened"
  | "manual_note";

export interface ActivityEntry {
  id:        string;   // crypto.randomUUID()
  type:      ActivityType;
  text:      string;   // human-readable description, stored in Hebrew
  createdAt: number;   // Unix ms
}

// Per-customer arrays stored oldest-first (append); displayed newest-first in UI
export type ActivityLog = Record<string, ActivityEntry[]>;
