import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/auth";

function isRole(r: unknown): r is AppUser["role"] {
  return r === "owner" || r === "manager" || r === "clerk";
}

export async function getAppUser(): Promise<AppUser> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { email: "", fullName: "", role: "clerk" };

  const { data } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const profile = data as { full_name: string; role: unknown } | null;
  if (!profile) return { email: user.email ?? "", fullName: "", role: "clerk" };

  return {
    email:    user.email ?? "",
    fullName: profile.full_name ?? "",
    role:     isRole(profile.role) ? profile.role : "clerk",
  };
}
