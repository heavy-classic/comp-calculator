import { createClient } from '@supabase/supabase-js';

// Lazy-initialized so the client isn't created at module load time during build
// (env vars may not be available when Docker builds the Next.js bundle)
let _client = null;

export function getSupabaseAdmin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _client;
}
