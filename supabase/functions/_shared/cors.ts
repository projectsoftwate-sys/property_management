/**
 * Shared CORS utility for all PropertyFlow Edge Functions.
 *
 * Usage:
 *   import { getCorsHeaders, jsonResponse, handleOptions } from '../_shared/cors.ts';
 *
 * Environment variable:
 *   ALLOWED_ORIGIN — set to your frontend URL in production
 *   e.g.  https://propertyflow.yourdomain.com
 *   Leave unset (or '*') for local development only.
 */

export function getCorsHeaders(req: Request) {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
  const requestOrigin = req.headers.get('Origin') || '';

  const origin =
    allowedOrigin === '*'
      ? '*'
      : requestOrigin === allowedOrigin
      ? allowedOrigin
      : '';

  return {
    'Access-Control-Allow-Origin':  origin || allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

export function jsonResponse(data: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/** Call at the top of every handler to short-circuit preflight requests. */
export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) });
  }
  return null;
}
