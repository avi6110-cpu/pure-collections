export type CollectionStatus =
  | "לא טופל"
  | "בטיפול"
  | "ממתין לתשלום"
  | "מועמד לתשלום"
  | "שולם";

export const ALL_STATUSES: CollectionStatus[] = [
  "לא טופל",
  "בטיפול",
  "ממתין לתשלום",
  "מועמד לתשלום",
  "שולם",
];

export interface CustomerStatus {
  status:               CollectionStatus;
  updatedAt:            number; // Unix ms
  expectedPaymentDate?: string; // ISO "YYYY-MM-DD", stored per customer, survives status changes
}

export type StatusMap = Record<string, CustomerStatus>;
