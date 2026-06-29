import { createClient } from "@/lib/supabase/client";
import type { ContactMap, CustomerContact } from "@/types/contacts";

// ── Cloud row type (matches customer_contacts schema exactly) ─────────────────

interface CloudContactRow {
  customer_name:  string;
  contact_person: string | null;
  phone:          string | null;
  email:          string | null;
  notes:          string | null;
  updated_at:     string;
}

// ── Converters ────────────────────────────────────────────────────────────────

function rowsToContactMap(rows: CloudContactRow[]): ContactMap {
  const map: ContactMap = {};
  for (const row of rows) {
    map[row.customer_name] = {
      ...(row.contact_person !== null ? { contactPerson: row.contact_person } : {}),
      ...(row.phone          !== null ? { phone:         row.phone          } : {}),
      ...(row.email          !== null ? { email:         row.email          } : {}),
      ...(row.notes          !== null ? { notes:         row.notes          } : {}),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }
  return map;
}

function contactToRow(
  customerName: string,
  contact:      CustomerContact,
  userId:       string,
  tenantId:     string,
) {
  return {
    tenant_id:      tenantId,
    customer_name:  customerName,
    contact_person: contact.contactPerson ?? null,
    phone:          contact.phone         ?? null,
    email:          contact.email         ?? null,
    notes:          contact.notes         ?? null,
    updated_at:     new Date(contact.updatedAt).toISOString(),
    updated_by:     userId,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all contacts for the current tenant from Supabase.
 * RLS restricts results to the authenticated user's tenant automatically.
 * Returns null on any error — caller should fall back to localStorage.
 */
export async function fetchCloudContacts(): Promise<ContactMap | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customer_contacts")
      .select("customer_name, contact_person, phone, email, notes, updated_at");
    if (error || !data) return null;
    return rowsToContactMap(data as CloudContactRow[]);
  } catch {
    return null;
  }
}

/**
 * Upsert a single contact to Supabase.
 * Returns true on success, false on any failure.
 * Caller keeps the localStorage write regardless of the return value.
 */
export async function upsertCloudContact(
  customerName: string,
  contact:      CustomerContact,
  userId:       string,
  tenantId:     string,
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("customer_contacts")
      .upsert(contactToRow(customerName, contact, userId, tenantId), {
        onConflict: "tenant_id,customer_name",
      });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Bulk upsert a ContactMap subset to Supabase.
 * Used by the API sync flow to persist newly filled contact fields.
 * Returns true on success, false on any failure.
 */
export async function upsertCloudContacts(
  contacts: ContactMap,
  userId:   string,
  tenantId: string,
): Promise<boolean> {
  const entries = Object.entries(contacts);
  if (entries.length === 0) return true;
  try {
    const supabase = createClient();
    const rows = entries.map(([name, contact]) =>
      contactToRow(name, contact, userId, tenantId),
    );
    const { error } = await supabase
      .from("customer_contacts")
      .upsert(rows, { onConflict: "tenant_id,customer_name" });
    return !error;
  } catch {
    return false;
  }
}
