export type CollectionStatus =
  | "לא טופל"
  | "בטיפול"
  | "ממתין לתשלום"
  | "מועמד לתשלום"
  | "במחלוקת"
  | "שולם";

export const ALL_STATUSES: CollectionStatus[] = [
  "לא טופל",
  "בטיפול",
  "ממתין לתשלום",
  "מועמד לתשלום",
  "במחלוקת",
  "שולם",
];

export interface DocumentStatus {
  status:               CollectionStatus;
  updatedAt:            number;
  expectedPaymentDate?: string;
}

// Keyed by docStatusKey: `${customerName}|${documentType}|${documentNumber}`
export type StatusMap = Record<string, DocumentStatus>;
