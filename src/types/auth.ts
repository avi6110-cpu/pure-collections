export interface AppUser {
  id:       string;  // auth.users UUID
  tenantId: string;  // tenants.id
  email:    string;
  fullName: string;
  role:     "owner" | "manager" | "clerk";
}

export const ROLE_LABEL: Record<AppUser["role"], string> = {
  owner:   "בעלים",
  manager: "מנהל",
  clerk:   "פקיד",
};
