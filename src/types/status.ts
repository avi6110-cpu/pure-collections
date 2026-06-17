export type CollectionStatus =
  | "לא טופל"
  | "בטיפול"
  | "הבטיח לשלם"
  | "מועמד לתשלום"
  | "שולם";

export const ALL_STATUSES: CollectionStatus[] = [
  "לא טופל",
  "בטיפול",
  "הבטיח לשלם",
  "מועמד לתשלום",
  "שולם",
];

export interface CustomerStatus {
  status:    CollectionStatus;
  updatedAt: number; // Unix ms
}

// Keyed by exact customerName string
export type StatusMap = Record<string, CustomerStatus>;
