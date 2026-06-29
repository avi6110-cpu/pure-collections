import { getAppUser } from "@/lib/supabase/user";
import { AppShell } from "@/components/AppShell";

export default async function HomePage() {
  const user = await getAppUser();
  return <AppShell user={user} />;
}
