import { getCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CreateIssueRequest {
  property_id: string;
  unit_id?: string;
  category: 'fire' | 'electrical' | 'gas' | 'water' | 'general';
  title: string;
  description: string;
}

interface UpdateIssueRequest {
  status?: 'open' | 'assigned' | 'in_progress' | 'completed';
  assigned_to?: string;
  completed_at?: string;
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

    if (req.method === 'GET') {
      const issueId = path[path.length - 1];

      if (issueId && issueId !== 'maintenance-issues') {
        const { data: issue, error } = await supabase
          .from('maintenance_issues')
          .select(`
            *,
            property:properties(*),
            unit:units(*),
            creator:profiles!maintenance_issues_created_by_fkey(id, full_name, role),
            assignee:profiles!maintenance_issues_assigned_to_fkey(id, full_name, role),
            attachments:issue_attachments(*)
          `)
          .eq('id', issueId)
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
          JSON.stringify({ data: issue }),
          {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        );
      }

      const status = url.searchParams.get('status');
      const propertyId = url.searchParams.get('property_id');

      let query = supabase
        .from('maintenance_issues')
        .select(`
          *,
          property:properties(id, name, address),
          unit:units(id, unit_number),
          creator:profiles!maintenance_issues_created_by_fkey(id, full_name, role),
          assignee:profiles!maintenance_issues_assigned_to_fkey(id, full_name, role)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data: issues, error } = await query;

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
        JSON.stringify({ data: issues }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'POST') {
      const body: CreateIssueRequest = await req.json();

      const { data: issue, error } = await supabase
        .from('maintenance_issues')
        .insert({
          property_id: body.property_id,
          unit_id: body.unit_id,
          created_by: user.id,
          category: body.category,
          title: body.title,
          description: body.description,
          status: 'open',
        })
        .select(`
          *,
          property:properties(*),
          unit:units(*),
          creator:profiles!maintenance_issues_created_by_fkey(*)
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
        JSON.stringify({ data: issue }),
        {
          status: 201,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'PUT') {
      const issueId = path[path.length - 1];
      const body: UpdateIssueRequest = await req.json();

      const updateData: Record<string, unknown> = {};

      if (body.status) {
        updateData.status = body.status;
        if (body.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      if (body.assigned_to !== undefined) {
        updateData.assigned_to = body.assigned_to;
        if (body.assigned_to && updateData.status === undefined) {
          updateData.status = 'assigned';
        }
      }

      const { data: issue, error } = await supabase
        .from('maintenance_issues')
        .update(updateData)
        .eq('id', issueId)
        .select(`
          *,
          property:properties(*),
          unit:units(*),
          creator:profiles!maintenance_issues_created_by_fkey(*),
          assignee:profiles!maintenance_issues_assigned_to_fkey(*)
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
        JSON.stringify({ data: issue }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'DELETE') {
      const issueId = path[path.length - 1];

      const { error } = await supabase
        .from('maintenance_issues')
        .delete()
        .eq('id', issueId);

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

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
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
