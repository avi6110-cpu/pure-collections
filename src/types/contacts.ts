export interface CustomerContact {
  contactPerson?: string;
  phone?:         string;
  email?:         string;
  notes?:         string;
  updatedAt:      number; // Unix ms of last save
}

// Keyed by exact customerName string
export type ContactMap = Record<string, CustomerContact>;
