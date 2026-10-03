import { getAuth } from '@/server/auth';
export const runtime = 'nodejs';
// Expose only this slice's supported authentication surface.
const allowed = new Set(['email-otp/send-verification-otp', 'sign-in/email-otp', 'get-session', 'sign-out']);
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace('/api/auth/', '');
  if (!allowed.has(path)) return new Response(null, { status: 404 });
  try {
    const response = await getAuth().handler(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch { return Response.json({ message: 'Authentication is temporarily unavailable.' }, { status: 503 }); }
}
export const GET = handle;
export const POST = handle;
