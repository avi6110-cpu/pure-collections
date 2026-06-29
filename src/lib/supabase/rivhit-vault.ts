import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface UserRow { tenant_id: string }
interface HintRow { token_hint: string }

// Resolves the calling user's tenant_id from the users table.
async function getTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  return (data as UserRow | null)?.tenant_id ?? null;
}

// Returns the Rivhit API token for the current user's tenant, or null if not set.
// Token is read from Supabase Vault via the service-role admin client.
// The token is NEVER returned to the browser — call this only in server-side code.
export async function getVaultToken(): Promise<string | null> {
  const tenantId = await getTenantId();
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_rivhit_token", {
    p_tenant_id: tenantId,
  });

  if (error || data === null || data === undefined) return null;
  return data as string;
}

// Returns the tenant_id and token_hint for the settings page.
// hint comes from rivhit_credentials.token_hint — never the real token.
export async function getVaultHint(): Promise<{ tenantId: string; hint: string | null } | null> {
  const tenantId = await getTenantId();
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("rivhit_credentials")
    .select("token_hint")
    .eq("tenant_id", tenantId)
    .single();

  const hint = (data as HintRow | null)?.token_hint ?? null;
  return { tenantId, hint };
}

// Saves a new Rivhit token to Vault for the current user's tenant.
// Returns the hint (last 4 chars masked) on success, null on failure.
export async function saveVaultToken(token: string): Promise<string | null> {
  const tenantId = await getTenantId();
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { error } = await admin.rpc("upsert_rivhit_token", {
    p_tenant_id: tenantId,
    p_token: token,
  });

  if (error) return null;

  // Read back the hint that the DB stored
  const { data } = await admin
    .from("rivhit_credentials")
    .select("token_hint")
    .eq("tenant_id", tenantId)
    .single();

  return (data as HintRow | null)?.token_hint ?? `···${token.slice(-4)}`;
}
