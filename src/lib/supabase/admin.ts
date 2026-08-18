import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS, never import from a Client Component
 * or anything that ships to the browser. Only used server-side (Server
 * Actions) for operations the anon-key client isn't allowed to do, like
 * admin.createUser().
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
