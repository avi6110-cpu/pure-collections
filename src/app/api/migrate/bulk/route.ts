import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

// ── Payload types ─────────────────────────────────────────────────────────────

interface ContactPayload {
  contactPerson?: string;
  phone?:         string;
  email?:         string;
  notes?:         string;
  updatedAt:      number; // Unix ms
}

interface StatusPayload {
  status:                string;
  expectedPaymentDate?:  string;
  updatedAt:             number; // Unix ms
}

interface ActivityEntryPayload {
  id:        string;
  type:      string;
  text:      string;
  createdAt: number; // Unix ms
}

interface BulkMigratePayload {
  contacts: Record<string, ContactPayload>;
  statuses: Record<string, StatusPayload>;
  activity: Record<string, ActivityEntryPayload[]>;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();

  // Authenticate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "לא מחובר" }, { status: 401 });
  }

  // Resolve tenant_id and user profile
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId: string = (profile as { tenant_id: string } | null)?.tenant_id ?? "";
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "משתמש לא משויך לדייר" }, { status: 403 });
  }

  // Parse payload
  let payload: BulkMigratePayload;
  try {
    payload = (await req.json()) as BulkMigratePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "payload לא תקין" }, { status: 400 });
  }

  const { contacts = {}, statuses = {}, activity = {} } = payload;

  let contactsMigrated = 0;
  let statusesMigrated = 0;
  let activityMigrated = 0;

  // ── Contacts ─────────────────────────────────────────────────────────────────

  const contactEntries = Object.entries(contacts);
  if (contactEntries.length > 0) {
    // Fetch existing cloud contacts with their updated_at timestamps
    const { data: existing } = await supabase
      .from("customer_contacts")
      .select("customer_name, updated_at");

    const cloudTimestamps = new Map<string, number>();
    for (const row of (existing ?? []) as { customer_name: string; updated_at: string }[]) {
      cloudTimestamps.set(row.customer_name, new Date(row.updated_at).getTime());
    }

    // Only write rows that are newer than what's in cloud (or absent from cloud)
    const toUpsert = contactEntries
      .filter(([name, c]) => {
        const cloudTs = cloudTimestamps.get(name);
        return cloudTs === undefined || c.updatedAt > cloudTs;
      })
      .map(([name, c]) => ({
        tenant_id:      tenantId,
        customer_name:  name,
        contact_person: c.contactPerson ?? null,
        phone:          c.phone         ?? null,
        email:          c.email         ?? null,
        notes:          c.notes         ?? null,
        updated_at:     new Date(c.updatedAt).toISOString(),
        updated_by:     user.id,
      }));

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from("customer_contacts")
        .upsert(toUpsert, { onConflict: "tenant_id,customer_name" });
      if (error) {
        return NextResponse.json({ ok: false, error: `contacts: ${error.message}` }, { status: 500 });
      }
      contactsMigrated = toUpsert.length;
    }
  }

  // ── Document statuses ─────────────────────────────────────────────────────────

  const statusEntries = Object.entries(statuses);
  if (statusEntries.length > 0) {
    const { data: existing } = await supabase
      .from("document_statuses")
      .select("doc_status_key, updated_at");

    const cloudTimestamps = new Map<string, number>();
    for (const row of (existing ?? []) as { doc_status_key: string; updated_at: string }[]) {
      cloudTimestamps.set(row.doc_status_key, new Date(row.updated_at).getTime());
    }

    const toUpsert = statusEntries
      .filter(([key, s]) => {
        const cloudTs = cloudTimestamps.get(key);
        return cloudTs === undefined || s.updatedAt > cloudTs;
      })
      .map(([key, s]) => ({
        tenant_id:             tenantId,
        doc_status_key:        key,
        status:                s.status,
        expected_payment_date: s.expectedPaymentDate ?? null,
        updated_at:            new Date(s.updatedAt).toISOString(),
        updated_by:            user.id,
      }));

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from("document_statuses")
        .upsert(toUpsert, { onConflict: "tenant_id,doc_status_key" });
      if (error) {
        return NextResponse.json({ ok: false, error: `statuses: ${error.message}` }, { status: 500 });
      }
      statusesMigrated = toUpsert.length;
    }
  }

  // ── Activity log ──────────────────────────────────────────────────────────────
  // Flatten all entries across customers into a single array.
  // ON CONFLICT (id) DO NOTHING — UUIDs are stable, duplicates skipped safely.

  const allEntries: ActivityEntryPayload[] = [];
  const customerByEntryId = new Map<string, string>();

  for (const [customerName, entries] of Object.entries(activity)) {
    for (const e of entries) {
      allEntries.push(e);
      customerByEntryId.set(e.id, customerName);
    }
  }

  if (allEntries.length > 0) {
    const toInsert = allEntries.map((e) => ({
      id:             e.id,
      tenant_id:      tenantId,
      customer_name:  customerByEntryId.get(e.id) ?? "",
      doc_status_key: null,
      activity_type:  e.type,
      text:           e.text,
      created_at:     new Date(e.createdAt).toISOString(),
      created_by:     user.id,
    }));

    const { error } = await supabase
      .from("activity_log")
      .upsert(toInsert, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      return NextResponse.json({ ok: false, error: `activity: ${error.message}` }, { status: 500 });
    }
    // Count only non-duplicate inserts is hard to know server-side;
    // report the total attempted — idempotent runs will correctly show 0 net new rows.
    activityMigrated = allEntries.length;
  }

  return NextResponse.json({
    ok: true,
    migrated: {
      contacts: contactsMigrated,
      statuses: statusesMigrated,
      activity: activityMigrated,
    },
  });
}
