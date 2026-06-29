import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/auth";

function isRole(r: unknown): r is AppUser["role"] {
  return r === "owner" || r === "manager" || r === "clerk";
}

export async function getAppUser(): Promise<AppUser> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { id: "", tenantId: "", email: "", fullName: "", role: "clerk" };

  const { data } = await supabase
    .from("users")
    .select("full_name, role, tenant_id")
    .eq("id", user.id)
    .single();

  const profile = data as { full_name: string; role: unknown; tenant_id: string } | null;
  if (!profile) return { id: user.id, tenantId: "", email: user.email ?? "", fullName: "", role: "clerk" };

  return {
    id:       user.id,
    tenantId: profile.tenant_id ?? "",
    email:    user.email ?? "",
    fullName: profile.full_name ?? "",
    role:     isRole(profile.role) ? profile.role : "clerk",
  };
}
