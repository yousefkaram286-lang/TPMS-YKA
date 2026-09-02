// ============================================================
// TPMS — create-user Edge Function
// ------------------------------------------------------------
// Admin-only endpoint that creates a new Supabase Auth user
// (email + password) with role = 'User'.
//
// Security:
//   - verify_jwt = true (see supabase/config.toml): the
//     platform rejects requests without a valid JWT.
//   - The caller's profile is looked up server-side; only an
//     active Admin may create users.
//   - Uses the service-role key (server-side only) to call
//     auth.admin.createUser, so GoTrue handles password
//     hashing. No plaintext passwords ever reach the DB tables.
//   - The on_auth_user_created trigger auto-creates the
//     public.profiles row (role forced to 'User').
//
// Deploy:  supabase functions deploy create-user
// Test:    invoke with an Admin's access token.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(headers: Record<string, string>, body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(corsHeaders, { error: 'Method not allowed' }, 405);
  }

  // 1. Identify the caller from their JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return json(corsHeaders, { error: 'Unauthorized' }, 401);
  }

  const { data: caller, error: callerError } = await supabase.auth.getUser(jwt);
  if (callerError || !caller?.user) {
    return json(corsHeaders, { error: 'Unauthorized' }, 401);
  }

  // 2. Verify the caller is an active Admin (from the DB, never the client).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', caller.user.id)
    .single();

  if (profileError || !profile) {
    return json(corsHeaders, { error: 'Forbidden: profile not found' }, 403);
  }
  if (profile.role !== 'Admin' || profile.active !== true) {
    return json(corsHeaders, { error: 'Forbidden: Admin role required' }, 403);
  }

  // 3. Validate input.
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const username = String(body?.username ?? '').trim();
  const displayName = String(body?.displayName ?? '').trim();

  if (!body) {
    return json(corsHeaders, { error: 'Invalid JSON body' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(corsHeaders, { error: 'A valid email is required.' }, 400);
  }
  if (password.length < 6) {
    return json(corsHeaders, { error: 'Password must be at least 6 characters.' }, 400);
  }
  if (!username) {
    return json(corsHeaders, { error: 'Username is required.' }, 400);
  }

  // 4. Create the auth user. Role is always 'User' — the profiles
  //    trigger also forces this regardless of metadata.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName || username,
      role: 'User',
    },
  });

  if (error) {
    return json(corsHeaders, { error: error.message }, 400);
  }

  return json(corsHeaders, {
    success: true,
    user: { id: data.user.id, email: data.user.email },
  }, 200);
});