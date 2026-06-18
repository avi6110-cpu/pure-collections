"use client";

import { useState, startTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

// ── Contact field specs ───────────────────────────────────────────────────────

interface ContactSpec {
  key: string;
  label: string;
  candidates: string[];
}

const CONTACT_SPECS: ContactSpec[] = [
  {
    key: "customer_id",
    label: "מזהה לקוח (לקישור)",
    candidates: ["customer_id", "client_id", "customer_number", "clientId", "customerId"],
  },
  {
    key: "contact_name",
    label: "איש קשר",
    candidates: ["contact_name", "contact_person", "person_name", "contact", "contactName"],
  },
  {
    key: "phone",
    label: "טלפון",
    candidates: ["phone", "phone_number", "phone1", "telephone", "tel", "phone_1"],
  },
  {
    key: "mobile",
    label: "נייד",
    candidates: ["mobile", "mobile_phone", "cell_phone", "cellular", "nayad", "cellPhone", "mobilePhone"],
  },
  {
    key: "email",
    label: "אימייל",
    candidates: ["email", "email_address", "e_mail", "mail", "emailAddress"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function findCI(obj: Record<string, unknown>, candidates: string[]): { key: string; value: unknown } | null {
  for (const c of candidates) {
    if (c in obj) return { key: c, value: obj[c] };
  }
  const objKeys = Object.keys(obj);
  for (const c of candidates) {
    const found = objKeys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (found !== undefined) return { key: found, value: obj[found] };
  }
  return null;
}

interface FieldResult {
  spec: ContactSpec;
  found: boolean;
  actualKey: string | null;
  sampleValue: string | null;
}

function analyzeRecord(obj: Record<string, unknown>): FieldResult[] {
  return CONTACT_SPECS.map((spec) => {
    const hit = findCI(obj, spec.candidates);
    return {
      spec,
      found: hit !== null,
      actualKey: hit?.key ?? null,
      sampleValue: hit !== null ? String(hit.value ?? "") : null,
    };
  });
}

function findArrayInResponse(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data) && data.length > 0) {
    if (typeof data[0] === "object" && data[0] !== null) {
      return data as Record<string, unknown>[];
    }
  }
  if (data !== null && typeof data === "object") {
    for (const val of Object.values(data as Record<string, unknown>)) {
      const found = findArrayInResponse(val);
      if (found !== null) return found;
    }
  }
  return null;
}

function readToken(): string {
  try {
    const raw = localStorage.getItem("pure-collections:settings");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { rivhitApiToken?: string };
    return parsed.rivhitApiToken ?? "";
  } catch {
    return "";
  }
}

// ── Result types ──────────────────────────────────────────────────────────────

type ProbeStatus = "idle" | "running" | "ok" | "error" | "no-data";

interface ProbeResult {
  status: ProbeStatus;
  label: string;
  endpoint: string;
  recordCount: number;
  fields: FieldResult[];
  hasCustomerId: boolean;
  customerIdKey: string | null;
  sampleRecord: Record<string, unknown> | null;
  rawKeys: string[];
  error: string | null;
  rawPreview: string;
}

function emptyProbe(label: string, endpoint: string): ProbeResult {
  return {
    status: "idle", label, endpoint,
    recordCount: 0, fields: [], hasCustomerId: false,
    customerIdKey: null, sampleRecord: null, rawKeys: [],
    error: null, rawPreview: "",
  };
}

// ── Page state ────────────────────────────────────────────────────────────────

interface PageState {
  running: boolean;
  probeA: ProbeResult;  // Customer.OpenDocuments (documents already have contact?)
  probeB: ProbeResult;  // Customer.List
  probeB2: ProbeResult; // Customer.Get (fallback, uses customer_id from probeA)
  done: boolean;
  noToken: boolean;
}

const INITIAL: PageState = {
  running: false,
  probeA:  emptyProbe("Customer.OpenDocuments — האם מסמכים כוללים שדות קשר?", "customer-open-documents"),
  probeB:  emptyProbe("Customer.List — רשימת לקוחות", "customer-list"),
  probeB2: emptyProbe("Customer.Get — פרטי לקוח בודד", "customer-get"),
  done: false,
  noToken: false,
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContactCheckPage() {
  const [state, setState] = useState<PageState>(INITIAL);

  async function runChecks() {
    const token = readToken();
    if (!token) {
      startTransition(() => setState({ ...INITIAL, noToken: true }));
      return;
    }

    startTransition(() => setState({ ...INITIAL, running: true }));

    // ── Probe A: Customer.OpenDocuments ───────────────────────────────────────
    let probeA = emptyProbe(INITIAL.probeA.label, INITIAL.probeA.endpoint);
    let detectedCustomerId: number | null = null;

    try {
      const res = await fetch("/api/rivhit/customer-open-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
        body: JSON.stringify({}),
      });
      const data: unknown = await res.json();
      const arr = findArrayInResponse(data);
      if (arr === null || arr.length === 0) {
        probeA = { ...probeA, status: "no-data", error: "לא הוחזרו מסמכים", rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
      } else {
        const sample = arr[0]!;
        const fields = analyzeRecord(sample);
        const customerIdHit = findCI(sample, CONTACT_SPECS[0]!.candidates);
        if (customerIdHit !== null) {
          const v = Number(customerIdHit.value);
          if (!isNaN(v) && v > 0) detectedCustomerId = v;
        }
        probeA = {
          ...probeA,
          status: "ok",
          recordCount: arr.length,
          fields,
          hasCustomerId: customerIdHit !== null,
          customerIdKey: customerIdHit?.key ?? null,
          sampleRecord: sample,
          rawKeys: Object.keys(sample),
          rawPreview: JSON.stringify(sample, null, 2).slice(0, 2000),
        };
      }
    } catch (err) {
      probeA = { ...probeA, status: "error", error: err instanceof Error ? err.message : "שגיאת רשת" };
    }

    startTransition(() => setState((s) => ({ ...s, probeA })));

    // ── Probe B: Customer.List ────────────────────────────────────────────────
    let probeB = emptyProbe(INITIAL.probeB.label, INITIAL.probeB.endpoint);
    try {
      const res = await fetch("/api/rivhit/customer-list", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
        body: JSON.stringify({}),
      });
      const data: unknown = await res.json();

      // Check for API-level error
      if (data !== null && typeof data === "object") {
        const rec = data as Record<string, unknown>;
        if (typeof rec["error"] === "string") {
          probeB = { ...probeB, status: "error", error: rec["error"], rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
        } else if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) {
          const msg = typeof rec["client_message"] === "string" ? rec["client_message"] : `שגיאה ${String(rec["error_code"])}`;
          probeB = { ...probeB, status: "error", error: msg, rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
        }
      }

      if (probeB.status === "idle") {
        const arr = findArrayInResponse(data);
        if (arr === null || arr.length === 0) {
          probeB = { ...probeB, status: "no-data", error: "לא הוחזרו לקוחות", rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
        } else {
          const sample = arr[0]!;
          const fields = analyzeRecord(sample);
          const customerIdHit = findCI(sample, CONTACT_SPECS[0]!.candidates);
          probeB = {
            ...probeB,
            status: "ok",
            recordCount: arr.length,
            fields,
            hasCustomerId: customerIdHit !== null,
            customerIdKey: customerIdHit?.key ?? null,
            sampleRecord: sample,
            rawKeys: Object.keys(sample),
            rawPreview: JSON.stringify(sample, null, 2).slice(0, 2000),
          };
        }
      }
    } catch (err) {
      probeB = { ...probeB, status: "error", error: err instanceof Error ? err.message : "שגיאת רשת" };
    }

    startTransition(() => setState((s) => ({ ...s, probeB })));

    // ── Probe B2: Customer.Get (only if Customer.List failed and we have an ID) ──
    let probeB2 = emptyProbe(INITIAL.probeB2.label, INITIAL.probeB2.endpoint);
    const shouldTryGet = probeB.status !== "ok" && detectedCustomerId !== null;

    if (shouldTryGet && detectedCustomerId !== null) {
      try {
        const res = await fetch("/api/rivhit/customer-get", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Rivhit-Token": token },
          body: JSON.stringify({ customer_id: detectedCustomerId }),
        });
        const data: unknown = await res.json();

        if (data !== null && typeof data === "object") {
          const rec = data as Record<string, unknown>;
          if (typeof rec["error"] === "string") {
            probeB2 = { ...probeB2, status: "error", error: rec["error"], rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
          } else if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) {
            const msg = typeof rec["client_message"] === "string" ? rec["client_message"] : `שגיאה ${String(rec["error_code"])}`;
            probeB2 = { ...probeB2, status: "error", error: msg, rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
          }
        }

        if (probeB2.status === "idle") {
          // Customer.Get may return a single object, not an array
          let sample: Record<string, unknown> | null = null;
          const arr = findArrayInResponse(data);
          if (arr !== null && arr.length > 0) {
            sample = arr[0]!;
          } else if (data !== null && typeof data === "object" && !Array.isArray(data)) {
            const rec = data as Record<string, unknown>;
            if (Object.keys(rec).length > 2) sample = rec; // more than just error_code
          }

          if (sample === null) {
            probeB2 = { ...probeB2, status: "no-data", error: "לא הוחזר מידע לקוח", rawPreview: JSON.stringify(data, null, 2).slice(0, 1000) };
          } else {
            const fields = analyzeRecord(sample);
            const customerIdHit = findCI(sample, CONTACT_SPECS[0]!.candidates);
            probeB2 = {
              ...probeB2,
              status: "ok",
              recordCount: 1,
              fields,
              hasCustomerId: customerIdHit !== null,
              customerIdKey: customerIdHit?.key ?? null,
              sampleRecord: sample,
              rawKeys: Object.keys(sample),
              rawPreview: JSON.stringify(sample, null, 2).slice(0, 2000),
            };
          }
        }
      } catch (err) {
        probeB2 = { ...probeB2, status: "error", error: err instanceof Error ? err.message : "שגיאת רשת" };
      }
    } else if (!shouldTryGet) {
      probeB2 = { ...probeB2, status: "idle", error: probeB.status === "ok" ? "לא נדרש — Customer.List הצליח" : "לא נמצא customer_id במסמכים" };
    }

    startTransition(() => setState((s) => ({ ...s, probeB2, running: false, done: true })));
  }

  // ── Summary verdict ───────────────────────────────────────────────────────

  function buildVerdict(): { text: string; color: string } | null {
    if (!state.done) return null;
    const bestProbe = state.probeB.status === "ok"
      ? state.probeB
      : state.probeB2.status === "ok"
      ? state.probeB2
      : null;

    const docHasId = state.probeA.hasCustomerId;
    const docHasContact = state.probeA.fields.filter((f) => f.found && f.spec.key !== "customer_id").length > 0;

    if (docHasContact) {
      return { text: "✅ שדות קשר כבר קיימים ב-Customer.OpenDocuments — ניתן לייבא ישירות ללא endpoint נוסף", color: "green" };
    }
    if (bestProbe !== null) {
      const contactFields = bestProbe.fields.filter((f) => f.found && f.spec.key !== "customer_id");
      if (contactFields.length >= 3 && docHasId) {
        return { text: `✅ ${bestProbe.label} מחזיר שדות קשר, וה-customer_id קיים במסמכים — סנכרון מלא אפשרי`, color: "green" };
      }
      if (contactFields.length >= 3 && !docHasId) {
        return { text: `⚠️ ${bestProbe.label} מחזיר שדות קשר, אך אין customer_id במסמכים — קישור ישתמש בשם לקוח`, color: "amber" };
      }
      if (contactFields.length > 0) {
        return { text: `⚠️ חלק משדות הקשר נמצאו (${contactFields.length}/4) — בדוק פירוט למטה`, color: "amber" };
      }
      return { text: "❌ ה-endpoint נגיש אך לא מחזיר שדות קשר", color: "red" };
    }
    if (!docHasContact && state.probeB.status !== "ok" && state.probeB2.status !== "ok") {
      return { text: "❌ לא נמצא מקור לנתוני קשר — לא ניתן לסנכרן אוטומטית", color: "red" };
    }
    return null;
  }

  const verdict = buildVerdict();

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-4">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">בדיקת היתכנות — נתוני קשר מ-Rivhit API</h1>
            <p className="mt-0.5 text-sm text-gray-400">בדיקה זמנית בלבד. אינה משנה שום נתון.</p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← חזרה לדוחות</Link>
        </div>

        {state.noToken && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            טוקן API לא מוגדר.{" "}
            <Link href="/settings" className="font-medium underline">עבור להגדרות</Link>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-gray-500">
            הבדיקה תבצע 3 קריאות API ותדווח אילו שדות קשר זמינים: איש קשר, טלפון, נייד, אימייל.
          </p>
          <button
            type="button"
            onClick={() => { void runChecks(); }}
            disabled={state.running}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {state.running && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            )}
            {state.running ? "בודק…" : "הרץ בדיקת קשר"}
          </button>
        </div>

        {/* Verdict */}
        {verdict !== null && (
          <div className={`rounded-xl px-5 py-4 text-sm font-semibold ${
            verdict.color === "green" ? "bg-green-50 text-green-800" :
            verdict.color === "amber" ? "bg-amber-50 text-amber-800" :
            "bg-red-50 text-red-800"
          }`}>
            {verdict.text}
          </div>
        )}

        {/* Probe results */}
        {[state.probeA, state.probeB, state.probeB2].map((probe, idx) => (
          <ProbeCard key={idx} probe={probe} />
        ))}

      </div>
    </div>
  );
}

// ── ProbeCard ─────────────────────────────────────────────────────────────────

function ProbeCard({ probe }: { probe: ProbeResult }) {
  if (probe.status === "idle") return null;

  const contactFields = probe.fields.filter((f) => f.spec.key !== "customer_id");
  const foundContact = contactFields.filter((f) => f.found).length;
  const idField = probe.fields.find((f) => f.spec.key === "customer_id");

  const statusBadge: Record<ProbeStatus, { text: string; cls: string }> = {
    idle:     { text: "—",       cls: "bg-gray-100 text-gray-500" },
    running:  { text: "בודק…",   cls: "bg-blue-100 text-blue-700" },
    ok:       { text: "✓ הצלחה", cls: "bg-green-100 text-green-700" },
    error:    { text: "✗ שגיאה", cls: "bg-red-100 text-red-700" },
    "no-data":{ text: "ריק",     cls: "bg-amber-100 text-amber-700" },
  };
  const badge = statusBadge[probe.status];

  return (
    <Section title={probe.label}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
        <span className="font-mono text-xs text-gray-400">/api/rivhit/{probe.endpoint}</span>
        {probe.status === "ok" && (
          <span className="text-xs text-gray-500">{probe.recordCount} רשומות</span>
        )}
      </div>

      {probe.error !== null && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{probe.error}</p>
      )}

      {probe.status === "ok" && (
        <>
          {/* Contact field coverage */}
          <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500">שדה</th>
                  <th className="px-3 py-2 font-medium text-gray-500">מפתח ב-API</th>
                  <th className="px-3 py-2 font-medium text-gray-500">ערך לדוגמה</th>
                  <th className="px-3 py-2 font-medium text-gray-500">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {probe.fields.map((f) => (
                  <tr key={f.spec.key} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-700">{f.spec.label}</td>
                    <td className="px-3 py-2" dir="ltr">
                      {f.actualKey !== null
                        ? <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">{f.actualKey}</code>
                        : <span className="text-gray-300">{f.spec.candidates.slice(0, 3).join(" / ")}</span>
                      }
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-gray-500" dir="ltr">
                      {f.sampleValue !== null && f.sampleValue !== ""
                        ? <span className="font-mono">{f.sampleValue.slice(0, 40)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${f.found ? "text-green-600" : "text-red-400"}`}>
                        {f.found ? "✅ נמצא" : "⚠️ חסר"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary line */}
          <p className="mb-3 text-xs text-gray-500">
            שדות קשר: {foundContact}/{contactFields.length} נמצאו.{" "}
            {idField?.found === true
              ? `מזהה לקוח נמצא (${idField.actualKey ?? ""}) — קישור לפי ID אפשרי.`
              : "מזהה לקוח לא נמצא — קישור ישתמש בשם לקוח."
            }
          </p>

          {/* All raw field keys */}
          <details className="mb-2">
            <summary className="cursor-pointer text-xs text-gray-400">כל שדות ה-API ({probe.rawKeys.length})</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {probe.rawKeys.map((k) => (
                <span key={k} className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-xs text-gray-600">{k}</span>
              ))}
            </div>
          </details>

          {/* Raw sample record */}
          <details>
            <summary className="cursor-pointer text-xs text-gray-400">רשומה גולמית (לדוגמה)</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100" dir="ltr">
              {probe.rawPreview}
            </pre>
          </details>
        </>
      )}

      {(probe.status === "no-data" || probe.status === "error") && probe.rawPreview && (
        <details>
          <summary className="cursor-pointer text-xs text-gray-400">תגובה גולמית</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100" dir="ltr">
            {probe.rawPreview}
          </pre>
        </details>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-600">{title}</h3>
      {children}
    </div>
  );
}
