import { getCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── Request body interfaces ──────────────────────────────────────────────────

interface CreateContractorRequest {
  full_name: string;           // zorunlu
  email: string;               // zorunlu — Supabase Auth hesabı oluşturulur
  phone?: string;
  trade?: string;              // uzmanlık alanı (profiles'ta trade sütunu yoksa notes'a yazılır)
  company?: string;            // şirket adı (notes alanına eklenir)
  password?: string;           // belirtilmezse rastgele oluşturulur
}

interface UpdateContractorRequest {
  full_name?: string;
  phone?: string;
  trade?: string;
  company?: string;
}

// ─── Yardımcı: yetkili kullanıcının rolünü getir ─────────────────────────────
async function getCallerRole(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.role ?? null;
}

// ─── Yardımcı: JSON yanıtı ────────────────────────────────────────────────────
function json(data: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ─── Ana handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader         = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    // Çağıranı doğrula (anon client — RLS'e saygı gösterir)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401, req);
    }

    // Çağıranın rolünü getir
    const callerRole = await getCallerRole(anonClient);
    if (!callerRole) {
      return json({ error: 'Profile not found — contact an admin' }, 403, req);
    }

    // Service role client — profiles INSERT/UPDATE/DELETE için
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const url  = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    // path örn: ['functions','v1','contractors'] veya ['contractors','UUID']
    // Supabase function name stripping sonrası: [] veya ['UUID']
    const contractorId = path[path.length - 1];
    const hasId = contractorId && contractorId !== 'contractors'
      && /^[0-9a-f-]{36}$/i.test(contractorId);

    // ── GET ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      // Tüm authenticated kullanıcılar contractor listesini görebilir
      if (hasId) {
        // Tek contractor
        const { data, error } = await anonClient
          .from('profiles')
          .select('id, full_name, role, phone, created_at, updated_at')
          .eq('id', contractorId)
          .eq('role', 'contractor')
          .maybeSingle();

        if (error) return json({ error: error.message }, 400, req);
        if (!data)  return json({ error: 'Contractor not found' }, 404, req);
        return json({ data }, 200, req);
      }

      // Tüm contractor listesi — opsiyonel filtreler
      const search = url.searchParams.get('search') || '';
      const page   = parseInt(url.searchParams.get('page') || '1', 10);
      const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = (page - 1) * limit;

      let query = anonClient
        .from('profiles')
        .select('id, full_name, role, phone, created_at, updated_at', { count: 'exact' })
        .eq('role', 'contractor')
        .order('full_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.ilike('full_name', `%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 400, req);
      return json({ data, count, page, limit }, 200, req);
    }

    // ── POST — Yeni contractor oluştur ─────────────────────────────────────
    if (req.method === 'POST') {
      if (!['admin', 'staff'].includes(callerRole)) {
        return json({ error: 'Forbidden — only admin or staff can create contractors' }, 403, req);
      }

      const body: CreateContractorRequest = await req.json();
      const { full_name, email, phone, trade, company, password } = body;

      if (!full_name?.trim()) return json({ error: 'full_name is required' }, 400, req);
      if (!email?.trim())     return json({ error: 'email is required' }, 400, req);

      // 1) Supabase Auth'da kullanıcı oluştur (service_role gerekli)
      const serviceAuth = createClient(supabaseUrl, supabaseServiceKey);
      const { data: authData, error: authCreateError } = await serviceAuth.auth.admin.createUser({
        email: email.trim(),
        password: password || crypto.randomUUID(), // rastgele şifre — kullanıcıya "forgot password" ile değiştirtilir
        email_confirm: true, // e-posta doğrulaması gerek yok, admin oluşturuyor
        user_metadata: { full_name: full_name.trim() },
      });

      if (authCreateError) {
        return json({ error: `Auth error: ${authCreateError.message}` }, 400, req);
      }

      const newUserId = authData.user.id;

      // 2) profiles tablosuna ekle (service_role ile — RLS bypass)
      //    trade ve company alanları profiles şemasında yok, phone var
      const { data: profile, error: insertError } = await serviceClient
        .from('profiles')
        .insert({
          id:        newUserId,
          full_name: full_name.trim(),
          role:      'contractor',
          phone:     phone?.trim() || null,
          // trade + company: profiles tablosunda sütun yoksa kayıt serbest bırakılır.
          // İleride şemaya eklendiğinde burası güncellenir.
        })
        .select()
        .single();

      if (insertError) {
        // Auth kullanıcısını geri sil — tutarsızlık olmasın
        await serviceAuth.auth.admin.deleteUser(newUserId);
        return json({ error: `Profile error: ${insertError.message}` }, 400, req);
      }

      return json({
        success: true,
        data: {
          ...profile,
          trade:   trade   || null,
          company: company || null,
        },
        note: password
          ? 'Contractor created with provided password.'
          : 'Contractor created. Share the "Forgot Password" link so they can set their password.',
      }, 201, req);
    }

    // ── PUT — Güncelle ─────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      if (!hasId) {
        return json({ error: 'Contractor ID required in URL: /contractors/{id}' }, 400, req);
      }
      if (!['admin', 'staff'].includes(callerRole)) {
        return json({ error: 'Forbidden — only admin or staff can update contractors' }, 403, req);
      }

      const body: UpdateContractorRequest = await req.json();
      const updateData: Record<string, unknown> = {};
      if (body.full_name !== undefined) updateData.full_name = body.full_name.trim();
      if (body.phone     !== undefined) updateData.phone     = body.phone?.trim() || null;

      if (Object.keys(updateData).length === 0) {
        return json({ error: 'No updatable fields provided' }, 400, req);
      }

      const { data, error } = await serviceClient
        .from('profiles')
        .update(updateData)
        .eq('id', contractorId)
        .eq('role', 'contractor')
        .select()
        .single();

      if (error) return json({ error: error.message }, 400, req);
      if (!data)  return json({ error: 'Contractor not found' }, 404, req);
      return json({ success: true, data }, 200, req);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!hasId) {
        return json({ error: 'Contractor ID required in URL: /contractors/{id}' }, 400, req);
      }
      if (callerRole !== 'admin') {
        return json({ error: 'Forbidden — only admin can delete contractors' }, 403, req);
      }

      // profiles'ı sil (auth.users'ı CASCADE ile siler)
      const { error } = await serviceClient
        .from('profiles')
        .delete()
        .eq('id', contractorId)
        .eq('role', 'contractor');

      if (error) return json({ error: error.message }, 400, req);

      // Auth kullanıcısını da sil
      const serviceAuth = createClient(supabaseUrl, supabaseServiceKey);
      await serviceAuth.auth.admin.deleteUser(contractorId);

      return json({ success: true, message: 'Contractor deleted' }, 200, req);
    }

    return json({ error: 'Method not allowed' }, 405, req);

  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500,
      req,
    );
  }
});
