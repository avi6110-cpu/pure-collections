import { getAppUser } from "@/lib/supabase/user";
import { AppShell } from "@/components/AppShell";

export default async function UploadPage() {
  const user = await getAppUser();
  return <AppShell user={user} />;
}
