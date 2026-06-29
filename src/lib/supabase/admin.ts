import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS.
// Import ONLY in server-side code (Route Handlers, Server Actions).
// Never import this in Client Components or middleware.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
