import { policyVersion, requireAcknowledgement } from './policy.js';
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
  if (min === 8 && /[^\p{L}\p{Nd}!.?\-]/u.test(value)) {
    throw new Problem(400, 'Parola poate conține doar litere, cifre și semnele ! . ? -');
  }
  return value;
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
      return {next: type === 'recovery' ? '/parola-noua' : '/panel'};
    }
    const email = emailField(input.email);
    if (action === 'verifycode') {
      if (!['email', 'recovery', 'signup'].includes(input.type) || !/^\d{6,10}$/.test(input.code || ''))
        throw new Problem(400, 'Introdu codul numeric primit pe email.');
      const data = await auth('verify', 'POST', {type: input.type, email, token: input.code});
      writeSession(res, data, input.type === 'recovery');
      return {next: input.type === 'recovery' ? '/parola-noua' : '/panel'};
    }
    if (action === 'resend' || action === 'sendcode') {
      if (action === 'resend') await auth('resend', 'POST', {type: 'signup', email});
      else await auth('otp', 'POST', {email, create_user: false});
      return {message: 'Dacă adresa este eligibilă, verifică emailul și folderul Spam.'};
    }
    if (action === 'forgot') {
      await auth('recover', 'POST', {email});
      return {message: 'Dacă adresa aparține unui cont, vei primi instrucțiunile de resetare.'};
    }
    const password = passwordField(input.password, action === 'login' ? 1 : 8);
    if (action === 'signup') {
      requireAcknowledgement(input);
      const name = textField(input.name, 80, 'Numele');
      const data = await auth('signup', 'POST', {email, password, data: {name, pescurt_policy:policyVersion}});
      if (!data.access_token) return {message: 'Verifică emailul pentru a confirma adresa și a activa contul.'};
      writeSession(res, data);
    } else {
      const data = await auth('token?grant_type=password', 'POST', {email, password});
      writeSession(res, data);
    }
    return {next: '/panel'};
  } catch (error) {
    if (!(error instanceof ProviderError) || error.status >= 500) throw error;
    if (error.status === 429) throw new Problem(429, 'Ai făcut prea multe încercări. Revino peste câteva minute.');
    if (['sendcode','resend','forgot','signup'].includes(action) && ['email_address_not_authorized','email_provider_disabled','email_not_enabled'].includes(error.code))
      throw new Problem(503, 'Serviciul de email nu poate trimite mesaje momentan.');
    if (action === 'verifycode') throw new Problem(400, 'Cod invalid sau expirat. Cere un cod nou.');
    if (['sendcode','resend'].includes(action) && ['user_not_found','otp_disabled','email_exists'].includes(error.code))
      return {message: 'Dacă adresa este eligibilă, verifică emailul și folderul Spam.'};
    if (action === 'confirm') throw new Problem(400, 'Linkul a expirat sau a fost deja folosit.');
    if (action === 'login') {
      throw new Problem(401, error.code === 'email_not_confirmed' ? 'Confirmă adresa din email înainte de autentificare.' : 'Emailul sau parola este incorectă.');
    }
    if (action === 'forgot') return {message: 'Dacă adresa aparține unui cont, vei primi instrucțiunile de resetare.'};
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
