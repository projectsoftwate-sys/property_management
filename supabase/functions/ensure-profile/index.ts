import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────
// Production: set ALLOWED_ORIGIN env var to your frontend domain
// e.g. https://propertyflow.yourdomain.com
// If not set, defaults to '*' (only use '*' in local dev)
function getCorsHeaders(req: Request) {
  const allowedOrigin  = Deno.env.get('ALLOWED_ORIGIN') || '*';
  const requestOrigin  = req.headers.get('Origin') || '';
  const origin =
    allowedOrigin === '*'
      ? '*'
      : requestOrigin === allowedOrigin
      ? allowedOrigin
      : '';

  return {
    'Access-Control-Allow-Origin':  origin || allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

function json(data: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader         = req.headers.get('Authorization');

    // ── [FIX 1] Require a valid Bearer token ──────────────────────────────
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    // Verify the JWT using the anon client (validates signature + expiry)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Unauthorized — invalid or expired token' }, 401, req);
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { user_id, full_name, email } = body;

    if (!user_id) {
      return json({ error: 'Missing user_id' }, 400, req);
    }

    // ── [FIX 2] Token owner must match requested user_id ──────────────────
    // Prevents user A from creating/overwriting user B's profile
    if (user.id !== user_id) {
      return json({ error: 'Forbidden — user_id does not match authenticated user' }, 403, req);
    }

    // ── Service role client for DB writes (bypasses new-user RLS chicken-egg) 
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists
    const { data: existing, error: fetchError } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('id', user_id)
      .maybeSingle();

    if (fetchError) {
      return json({ error: fetchError.message }, 400, req);
    }

    if (existing) {
      return json({ success: true, message: 'Profile already exists', data: existing }, 200, req);
    }

    // ── [FIX 3] Default role → 'tenant' (least privileged) ────────────────
    // 'staff' and 'admin' must be granted manually by an existing admin
    const { data: profile, error: insertError } = await serviceClient
      .from('profiles')
      .insert({
        id:        user_id,
        full_name: full_name || (email ? email.split('@')[0] : 'User'),
        role:      'tenant',
      })
      .select()
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 400, req);
    }

    return json({ success: true, data: profile }, 200, req);

  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500,
      req,
    );
  }
});
