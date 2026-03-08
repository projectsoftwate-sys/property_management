import { getCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CreatePropertyRequest {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface UpdatePropertyRequest {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface CreateUnitRequest {
  property_id: string;
  unit_number: string;
  floor?: number;
  tenant_id?: string;
}

interface UpdateUnitRequest {
  unit_number?: string;
  floor?: number;
  tenant_id?: string;
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

    if (resource === 'properties' || !resource.includes('units')) {
      if (req.method === 'GET') {
        if (id && id !== 'properties') {
          const { data: property, error } = await supabase
            .from('properties')
            .select(`
              *,
              units(
                *,
                tenant:profiles(id, full_name, role, phone)
              )
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
            JSON.stringify({ data: property }),
            {
              status: 200,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        const { data: properties, error } = await supabase
          .from('properties')
          .select(`
            *,
            units(id)
          `)
          .order('created_at', { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 400,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        const propertiesWithCount = properties?.map(property => ({
          ...property,
          unit_count: property.units?.length || 0,
          units: undefined,
        }));

        return new Response(
          JSON.stringify({ data: propertiesWithCount }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'POST') {
        const body: CreatePropertyRequest = await req.json();

        const { data: property, error } = await supabase
          .from('properties')
          .insert({
            name: body.name,
            address: body.address,
            city: body.city,
            state: body.state,
            zip: body.zip,
          })
          .select()
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
          JSON.stringify({ data: property }),
          {
            status: 201,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'PUT') {
        const body: UpdatePropertyRequest = await req.json();

        const { data: property, error } = await supabase
          .from('properties')
          .update(body)
          .eq('id', id)
          .select()
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
          JSON.stringify({ data: property }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase
          .from('properties')
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

    if (resource === 'units' || resource.includes('units')) {
      if (req.method === 'GET') {
        if (id && id !== 'units') {
          const { data: unit, error } = await supabase
            .from('units')
            .select(`
              *,
              property:properties(*),
              tenant:profiles(id, full_name, role, phone, email)
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
            JSON.stringify({ data: unit }),
            {
              status: 200,
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            }
          );
        }

        const propertyId = url.searchParams.get('property_id');
        let query = supabase
          .from('units')
          .select(`
            *,
            property:properties(id, name, address),
            tenant:profiles(id, full_name, role)
          `)
          .order('unit_number', { ascending: true });

        if (propertyId) {
          query = query.eq('property_id', propertyId);
        }

        const { data: units, error } = await query;

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
          JSON.stringify({ data: units }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'POST') {
        const body: CreateUnitRequest = await req.json();

        const { data: unit, error } = await supabase
          .from('units')
          .insert({
            property_id: body.property_id,
            unit_number: body.unit_number,
            floor: body.floor,
            tenant_id: body.tenant_id,
          })
          .select(`
            *,
            property:properties(*),
            tenant:profiles(id, full_name, role)
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
          JSON.stringify({ data: unit }),
          {
            status: 201,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'PUT') {
        const body: UpdateUnitRequest = await req.json();

        const { data: unit, error } = await supabase
          .from('units')
          .update(body)
          .eq('id', id)
          .select(`
            *,
            property:properties(*),
            tenant:profiles(id, full_name, role)
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
          JSON.stringify({ data: unit }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase
          .from('units')
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
