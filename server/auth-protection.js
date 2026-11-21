import { createHmac } from 'node:crypto';
import { appUrl, hasAuth, Problem, rpc } from './services.js';

async function limit(scope, value, max, seconds) {
  const key = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(scope + ':' + value).digest('hex');
  if (!await rpc('consume_auth_limit', {p_key: key, p_limit: max, p_seconds: seconds})) {
    throw new Problem(429, 'Prea multe încercări. Așteaptă câteva minute și încearcă din nou.');
  }
}

export async function protectAuth(req, action, input) {
  if (!hasAuth) throw new Problem(503, 'Serviciul de conturi nu este configurat.');
  const ip = process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() : req.socket.remoteAddress;
  await limit('auth-ip', ip || 'unknown', 60, 600);
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Problem(503, 'Verificarea anti-robot nu este configurată.');
  if (typeof input.captcha !== 'string' || !input.captcha || input.captcha.length > 2048)
    throw new Problem(400, 'Completează verificarea anti-robot.');
  const body = new URLSearchParams({secret, response: input.captcha});
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body, signal: AbortSignal.timeout(8000)
  });
  const verdict = await response.json();
  if (!response.ok || !verdict.success || verdict.hostname !== new URL(appUrl).hostname || verdict.action !== 'pescurt_auth')
    throw new Problem(400, 'Repetă verificarea anti-robot.');
  const email = typeof input.email === 'string' ? input.email.toLowerCase().trim() : '';
  if (['signup','forgot','sendcode','resend'].includes(action)) {
    await limit('mail-ip', ip || 'unknown', 12, 600);
    await limit('mail-address', email, 4, 900);
    await limit('mail-cooldown', email, 1, 60);
  } else if (email) {
    await limit('attempt-' + action, email, 10, 600);
  }
}
