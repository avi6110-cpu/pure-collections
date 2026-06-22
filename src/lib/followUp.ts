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

// Count business days (Sun–Thu; Fri=5 and Sat=6 are skipped) in the
// half-open interval (from, to].  Returns 0 when to <= from.
function businessDaysDiff(from: string, to: string): number {
  const startMs = parseDateLocal(from);
  const endMs   = parseDateLocal(to);
  if (endMs <= startMs) return 0;
  let count = 0;
  let cur = startMs + 86_400_000; // day after 'from'
  while (cur <= endMs) {
    const dow = new Date(cur).getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
    if (dow !== 5 && dow !== 6) count++;
    cur += 86_400_000;
  }
  return count;
}

// A document requires today's follow-up when:
//   status === "מועמד לתשלום"
//   expectedPaymentDate is set
//   today is at least 3 BUSINESS days after that date
//   (Friday and Saturday are not counted — bank transfers, Shabbat)
export function isTodayFollowUp(
  docStatus: DocumentStatus | undefined,
  today: string,
): boolean {
  if (!docStatus || docStatus.status !== "מועמד לתשלום") return false;
  const epd = docStatus.expectedPaymentDate;
  if (!epd) return false;
  return businessDaysDiff(epd, today) >= 3;
}
