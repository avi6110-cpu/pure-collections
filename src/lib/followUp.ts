import type { DocumentStatus } from "@/types/status";

// Parse "YYYY-MM-DD" as a local-timezone midnight timestamp.
// Avoids the UTC-midnight bug from `new Date("YYYY-MM-DD")`.
function parseDateLocal(s: string): number {
  const parts = s.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d).getTime();
}

export function todayDateStr(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// A document requires today's follow-up when:
//   status === "מועמד לתשלום"
//   expectedPaymentDate is set
//   today is at least 3 days after that date (grace period for bank transfers)
export function isTodayFollowUp(
  docStatus: DocumentStatus | undefined,
  today: string,
): boolean {
  if (!docStatus || docStatus.status !== "מועמד לתשלום") return false;
  const epd = docStatus.expectedPaymentDate;
  if (!epd) return false;
  const daysDiff = Math.floor(
    (parseDateLocal(today) - parseDateLocal(epd)) / 86_400_000,
  );
  return daysDiff >= 3;
}
