import type { RivhitRow } from "@/lib/parseRivhit";

export type AgingBand = "fresh" | "yellow" | "red";
export type EnrichedRow = RivhitRow & { ageDays: number; band: AgingBand; daysUntilDue: number };
