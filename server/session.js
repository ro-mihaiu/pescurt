import { createHash, randomBytes } from 'node:crypto';
import { appUrl, auth, hasAuth, Problem, ProviderError, textField } from './services.js';

function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(item => item.trim().split(/=(.*)/s).slice(0, 2)));
}

function cookie(name, value, maxAge) {
  const secure = appUrl.startsWith('https:');
  return (secure ? '__Host-' : '') + name + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge +
    (secure ? '; Secure' : '');
}

function cookies(req) {
  const all = readCookies(req);
  const prefix = appUrl.startsWith('https:') ? '__Host-' : '';
  return {
    access: all[prefix + 'ps_access'], refresh: all[prefix + 'ps_refresh'], recovery: all[prefix + 'ps_recovery']
  };
}

function writeSession(res, data, recovery = false) {
  res.setHeader('Set-Cookie', [
    cookie('ps_access', data?.access_token || '', data ? (recovery ? Math.min(900, data.expires_in || 3600) : data.expires_in || 3600) : 0),
    cookie('ps_refresh', data?.refresh_token || '', data ? (recovery ? 900 : 2592000) : 0),
    cookie('ps_recovery', recovery ? '1' : '', recovery ? 900 : 0)
  ]);
}

export async function session(req, res) {
  if (!hasAuth) return null;
  const saved = cookies(req);
  if (saved.access) {
    try {
      const user = await auth('user', 'GET', undefined, saved.access);
      return {user, token: saved.access, recovery: !!saved.recovery};
    } catch (error) {
      if (!(error instanceof ProviderError) || ![401, 403].includes(error.status)) throw error;
    }
  }
  if (!saved.refresh) return null;
  try {
    const data = await auth('token?grant_type=refresh_token', 'POST', {refresh_token: saved.refresh});
    writeSession(res, data, !!saved.recovery);
    return {user: data.user, token: data.access_token, recovery: !!saved.recovery};
  } catch (error) {
    if (!(error instanceof ProviderError) || ![400, 401, 403].includes(error.status)) throw error;
    return null;
  }
}

function emailField(value) {
  const email = textField(value, 254, 'Adresa de email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Problem(400, 'Introdu o adresă de email validă.');
  return email;
}

function passwordField(value, min = 8) {
  if (typeof value !== 'string' || value.length < min || Buffer.byteLength(value) > 72) {
    throw new Problem(400, 'Verifică parola. Pentru o parolă nouă, folosește cel puțin 8 caractere și maximum 72 de octeți.');
  }
  return value;
}

export function startGoogleOAuth(res) {
  if (!hasAuth) throw new Problem(503, 'Autentificarea așteaptă configurarea serviciului de conturi.');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorize = new URL('/auth/v1/authorize', process.env.SUPABASE_URL);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', new URL('/api/auth/callback', appUrl).toString());
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 's256');
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', cookie('ps_pkce', verifier, 600));
  res.setHeader('Location', authorize.toString());
  res.end();
}

export async function googleOAuthCallback(req, res) {
  const url = new URL(req.url, appUrl);
  const cookiesInRequest = readCookies(req);
  const prefix = appUrl.startsWith('https:') ? '__Host-' : '';
  const verifier = cookiesInRequest[prefix + 'ps_pkce'];
  const code = url.searchParams.get('code');
  if (!hasAuth || !code || !verifier || url.searchParams.has('error')) {
    res.statusCode = 303;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', cookie('ps_pkce', '', 0));
    res.setHeader('Location', '/login?oauth=google');
    return res.end();
  }
  try {
    const data = await auth('token?grant_type=pkce', 'POST', {auth_code: code, code_verifier: verifier});
    writeSession(res, data);
    const sessionCookies = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', [...(Array.isArray(sessionCookies) ? sessionCookies : [sessionCookies]), cookie('ps_pkce', '', 0)]);
    res.statusCode = 303;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', '/acasa');
    res.end();
  } catch (error) {
    res.statusCode = 303;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', cookie('ps_pkce', '', 0));
    res.setHeader('Location', '/login?oauth=google');
    res.end();
  }
}

export async function publicAuth(action, input, res) {
  if (!hasAuth) throw new Problem(503, 'Autentificarea așteaptă configurarea serviciului de conturi.');
  try {
    if (action === 'confirm') {
      const type = input.type;
      if (!['email', 'recovery'].includes(type)) throw new Problem(400, 'Linkul de confirmare este invalid.');
      const token_hash = textField(input.token, 256, 'Codul de confirmare');
      const data = await auth('verify', 'POST', {type, token_hash});
      writeSession(res, data, type === 'recovery');
      return {next: type === 'recovery' ? '/parola-noua' : '/acasa'};
    }
    const email = emailField(input.email);
    if (action === 'forgot') {
      await auth('recover', 'POST', {email});
      return {message: 'Dacă adresa aparține unui cont, vei primi un link pentru resetarea parolei.'};
    }
    const password = passwordField(input.password, action === 'login' ? 1 : 8);
    if (action === 'signup') {
      const name = textField(input.name, 80, 'Numele');
      const data = await auth('signup', 'POST', {email, password, data: {name}});
      if (!data.access_token) return {message: 'Verifică emailul pentru a confirma adresa și a activa contul.'};
      writeSession(res, data);
    } else {
      const data = await auth('token?grant_type=password', 'POST', {email, password});
      writeSession(res, data);
    }
    return {next: '/acasa'};
  } catch (error) {
    if (!(error instanceof ProviderError) || error.status >= 500) throw error;
    if (error.status === 429) throw new Problem(429, 'Ai făcut prea multe încercări. Revino peste câteva minute.');
    if (action === 'confirm') throw new Problem(400, 'Linkul a expirat sau a fost deja folosit.');
    if (action === 'login') {
      throw new Problem(401, error.code === 'email_not_confirmed' ? 'Confirmă adresa din email înainte de autentificare.' : 'Emailul sau parola este incorectă.');
    }
    if (action === 'forgot') return {message: 'Dacă adresa aparține unui cont, vei primi un link pentru resetarea parolei.'};
    throw new Problem(400, 'Contul nu a putut fi creat. Verifică datele sau încearcă autentificarea.');
  }
}

export async function updateAccount(current, input, res) {
  if (current.recovery) {
    await auth('user', 'PUT', {password: passwordField(input.password)}, current.token);
    await logout(current, res);
    return {next: '/login'};
  }
  if (input.password) {
    const email = current.user.email;
    const currentPassword = passwordField(input.currentPassword, 1);
    try {
      const verified = await auth('token?grant_type=password', 'POST', {email, password: currentPassword});
      await auth('logout?scope=local', 'POST', undefined, verified.access_token);
    } catch (error) {
      if (error instanceof ProviderError && error.status < 500) throw new Problem(400, 'Parola actuală este incorectă sau verificarea a eșuat.');
      throw error;
    }
    await auth('user', 'PUT', {password: passwordField(input.password)}, current.token);
    await logout(current, res);
    return {next: '/login'};
  }
  const name = textField(input.name, 80, 'Numele');
  await auth('user', 'PUT', {data: {name}}, current.token);
  return {message: 'Numele a fost actualizat.'};
}

export async function logout(current, res) {
  if (current) {
    // Local logout revokes this session while preserving sessions on other devices.
    await auth('logout?scope=local', 'POST', undefined, current.token);
  }
  writeSession(res, null);
}
