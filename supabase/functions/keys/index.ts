import { getCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CreateKeySetRequest {
  property_id: string;
  name: string;
  description?: string;
}

interface CreateKeyRequest {
  key_set_id: string;
  key_number: string;
  description?: string;
}

interface CheckoutKeyRequest {
  key_id: string;
  checked_out_by: string;
  expected_return_at?: string;
  maintenance_issue_id?: string;
  notes?: string;
}

interface CheckinKeyRequest {
  notes?: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const resource = path[path.length - 2] || path[path.length - 1];
    const id = path[path.length - 1];

    if (resource === 'key-sets' || resource.includes('key-sets')) {
      if (req.method === 'GET') {
        if (id && id !== 'key-sets') {
          const { data: keySet, error } = await supabase
            .from('key_sets')
            .select(`
              *,
              property:properties(*),
              keys(*)
            `)
            .eq('id', id)
            .maybeSingle();

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message }),
              {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(
            JSON.stringify({ data: keySet }),
            {
              status: 200,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        const propertyId = url.searchParams.get('property_id');
        let query = supabase
          .from('key_sets')
          .select(`
            *,
            property:properties(id, name, address),
            keys(id, key_number, description)
          `)
          .order('created_at', { ascending: false });

        if (propertyId) {
          query = query.eq('property_id', propertyId);
        }

        const { data: keySets, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: keySets }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'POST') {
        const body: CreateKeySetRequest = await req.json();

        const { data: keySet, error } = await supabase
          .from('key_sets')
          .insert({
            property_id: body.property_id,
            name: body.name,
            description: body.description,
          })
          .select(`
            *,
            property:properties(*)
          `)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: keySet }),
          {
            status: 201,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase
          .from('key_sets')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (resource === 'keys' && !resource.includes('key-sets')) {
      if (req.method === 'POST') {
        const body: CreateKeyRequest = await req.json();

        const { data: key, error } = await supabase
          .from('keys')
          .insert({
            key_set_id: body.key_set_id,
            key_number: body.key_number,
            description: body.description,
          })
          .select(`
            *,
            key_set:key_sets(
              *,
              property:properties(*)
            )
          `)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: key }),
          {
            status: 201,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase
          .from('keys')
          .delete()
          .eq('id', id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (resource === 'checkouts' || resource.includes('checkout')) {
      if (req.method === 'GET') {
        const activeOnly = url.searchParams.get('active') === 'true';
        const userId = url.searchParams.get('user_id');

        let query = supabase
          .from('key_checkouts')
          .select(`
            *,
            key:keys(
              *,
              key_set:key_sets(
                *,
                property:properties(*)
              )
            ),
            user:profiles!key_checkouts_checked_out_by_fkey(*),
            issue:maintenance_issues(id, title, status)
          `)
          .order('checked_out_at', { ascending: false });

        if (activeOnly) {
          query = query.is('checked_in_at', null);
        }

        if (userId) {
          query = query.eq('checked_out_by', userId);
        }

        const { data: checkouts, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: checkouts }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'POST') {
        const body: CheckoutKeyRequest = await req.json();

        const { data: checkout, error } = await supabase
          .from('key_checkouts')
          .insert({
            key_id: body.key_id,
            checked_out_by: body.checked_out_by,
            expected_return_at: body.expected_return_at,
            maintenance_issue_id: body.maintenance_issue_id,
            notes: body.notes,
          })
          .select(`
            *,
            key:keys(
              *,
              key_set:key_sets(
                *,
                property:properties(*)
              )
            ),
            user:profiles!key_checkouts_checked_out_by_fkey(*),
            issue:maintenance_issues(id, title, status)
          `)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: checkout }),
          {
            status: 201,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'PUT') {
        const body: CheckinKeyRequest = await req.json();

        const { data: checkout, error } = await supabase
          .from('key_checkouts')
          .update({
            checked_in_at: new Date().toISOString(),
            notes: body.notes || '',
          })
          .eq('id', id)
          .select(`
            *,
            key:keys(
              *,
              key_set:key_sets(
                *,
                property:properties(*)
              )
            ),
            user:profiles!key_checkouts_checked_out_by_fkey(*)
          `)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ data: checkout }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
