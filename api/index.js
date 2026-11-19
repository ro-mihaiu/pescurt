import { timingSafeEqual } from 'node:crypto';
import { appUrl, dayKey, hasAI, hasAuth, Problem, rpc, zone } from '../server/services.js';
import { logout, publicAuth, session, updateAccount } from '../server/session.js';
import { notebook } from '../server/notebook.js';
import { admin, apply, isAdmin, latestStudent, purgeExpired } from '../server/students.js';

const publicActions = new Set(['auth/login', 'auth/signup', 'auth/forgot', 'auth/confirm']);
const notebookActions = new Set(['list', 'get', 'add', 'original', 'delete', 'process']);
const adminActions = new Set(['list', 'proof', 'decide', 'remove', 'purge']);
const extensions = {'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'};

function legalDetails() {
  const { LEGAL_OPERATOR_NAME, LEGAL_OPERATOR_ADDRESS, LEGAL_OPERATOR_REGISTRATION, LEGAL_CONTACT_EMAIL } = process.env;
  return {name: LEGAL_OPERATOR_NAME, address: LEGAL_OPERATOR_ADDRESS, registration: LEGAL_OPERATOR_REGISTRATION, email: LEGAL_CONTACT_EMAIL};
}

async function readBody(req, limit) {
  if (Number(req.headers['content-length']) > limit) throw new Problem(413, 'Fișierul e prea mare. Limita este de 3 MB.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Problem(413, 'Fișierul e prea mare. Limita este de 3 MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parse(raw) {
  if (!raw.length) return {};
  try {
    const value = JSON.parse(raw.toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new Problem(400, 'Datele trimise sunt invalide.');
  }
}

function write(res, status, result) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(result));
}

async function binary(res, {binary: response, type}) {
  const body = Buffer.from(await response.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="document.' + extensions[type] + '"');
  res.end(body);
}

function retentionAuthorized(value) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !value) return false;
  const expected = Buffer.from('Bearer ' + secret);
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, appUrl);
  const [group, action] = (url.pathname === '/api/index' && url.searchParams.has('route')
    ? url.searchParams.get('route') : url.pathname.slice(5)).split('/');
  const route = group + '/' + (action || '');
  try {
    if (req.method === 'GET' && group === 'config' && !action) {
      return write(res, 200, {auth: hasAuth, ai: hasAI, zone, legal: legalDetails()});
    }
    if (route === 'jobs/student-retention' && ['GET','POST'].includes(req.method)) {
      if (!hasAuth || !retentionAuthorized(req.headers.authorization)) throw new Problem(403, 'Acces interzis.');
      return write(res, 200, await purgeExpired());
    }
    if (req.method !== 'POST') throw new Problem(405, 'Metodă indisponibilă.');
    if (req.headers.origin !== appUrl) throw new Problem(403, 'Cererea trebuie să pornească din PeScurt.');
    if (!req.headers['content-type']?.startsWith('application/json')) throw new Problem(415, 'Format indisponibil.');
    const input = parse(await readBody(req, ['documents/add', 'student/apply'].includes(route) ? 4220000 : 131072));
    let result;
    if (publicActions.has(route)) {
      result = await publicAuth(action, input, res);
      return write(res, 200, result);
    }
    const current = await session(req, res);
    if (route === 'auth/session') return write(res, 200, {signedIn: !!current, recovery: !!current?.recovery});
    if (route === 'auth/logout') return write(res, 200, await logout(current, res) || {});
    if (!hasAuth) throw new Problem(503, 'Serviciul de conturi și baza de date așteaptă configurarea.');
    if (!current) throw new Problem(401, 'Autentifică-te pentru a continua.');
    if (route === 'auth/update') return write(res, 200, await updateAccount(current, input, res));
    if (current.recovery) throw new Problem(403, 'Setează o parolă nouă pentru a continua.');
    const user = current.user;
    if (route === 'account/') {
      const usage = await rpc('account_usage', {p_user: user.id, p_day: dayKey()});
      const limit = 2;
      result = {name: user.user_metadata?.name || '', email: user.email,
        used: usage.used, limit, remaining: Math.max(0, limit - usage.used), zone};
    } else if (group === 'documents' && notebookActions.has(action)) {
      result = await notebook(action, user, input);
    } else if (route === 'student/apply') {
      result = await apply(user, input);
    } else if (group === 'admin' && adminActions.has(action)) {
      result = await admin(action, user, input);
    } else {
      throw new Problem(404, 'Acțiunea nu a fost găsită.');
    }
    if (result.binary) return await binary(res, result);
    return write(res, 200, result);
  } catch (error) {
    if (error instanceof Problem) return write(res, error.status, {error: error.message});
    console.error('PeScurt request failed', {route, type: error.name, status: error.status, code: error.code});
    return write(res, 502, {error: 'Serviciul nu a putut răspunde. Încearcă din nou în câteva momente.'});
  }
}
