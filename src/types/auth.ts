export interface AppUser {
  email:    string;
  fullName: string;
  role:     "owner" | "manager" | "clerk";
}

export const ROLE_LABEL: Record<AppUser["role"], string> = {
  owner:   "בעלים",
  manager: "מנהל",
  clerk:   "פקיד",
};
