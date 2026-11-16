import { randomUUID } from 'node:crypto';
import { db, Problem, ProviderError, proofs, query, storage, textField, uploaded, uuid } from './services.js';

const selectStudent = 'id,status,created_at,reviewed_at,reason,expires_at';
const retentionDays = Number(process.env.STUDENT_PROOF_RETENTION_DAYS || 30);
if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
  throw new Error('STUDENT_PROOF_RETENTION_DAYS must be an integer between 1 and 365.');
}

export async function latestStudent(userId) {
  const [request] = await db('student_requests' + query({
    user_id: 'eq.' + userId, select: selectStudent, order: 'created_at.desc', limit: '1'
  }));
  return request;
}

export const isAdmin = async userId => !!(await db('admins' + query({user_id: 'eq.' + userId, limit: '1'}))).length;

export async function apply(user, input) {
  const file = uploaded(input.file);
  const latest = await latestStudent(user.id);
  if (latest && latest.status !== 'rejected') throw new Problem(409, 'Ai deja o cerere în așteptare sau aprobată.');
  const applicant_name = textField(user.user_metadata?.name, 80, 'Numele din profil');
  const id = randomUUID();
  const expires_at = new Date(Date.now() + retentionDays * 86400000).toISOString();
  await storage(proofs, id, 'POST', file);
  try {
    await db('student_requests', 'POST', {id, user_id: user.id, applicant_name, file_type: file.type, expires_at});
  } catch (error) {
    await storage(proofs, id, 'DELETE').catch(() => {});
    if (error instanceof ProviderError && error.code === '23505') throw new Problem(409, 'Ai deja o cerere activă.');
    throw error;
  }
  return {message: 'Cererea a fost trimisă pentru verificare manuală.'};
}

async function removeProof(request) {
  if (!request.file_type) return false;
  await storage(proofs, request.id, 'DELETE');
  await db('student_requests' + query({id: 'eq.' + request.id}), 'PATCH', {file_type: null});
  return true;
}

async function rejectExpired(request) {
  await db('student_requests' + query({id: 'eq.' + request.id, status: 'eq.pending',
    expires_at: 'lte.' + new Date().toISOString()}), 'PATCH', {
    status: 'rejected', reviewed_at: new Date().toISOString(),
    reason: 'Perioada de păstrare a documentului a expirat înainte de verificare. Poți trimite o cerere nouă.'
  });
}

export async function purgeExpired() {
  const requests = await db('student_requests' + query({file_type: 'not.is.null', expires_at: 'lte.' + new Date().toISOString(),
    order: 'expires_at.asc', limit: '25'}));
  for (const request of requests) {
    await rejectExpired(request);
    await removeProof(request);
  }
  return {deleted: requests.length};
}

export async function admin(action, user, input) {
  if (!await isAdmin(user.id)) throw new Problem(403, 'Ai nevoie de acces de administrator.');
  if (action === 'purge') return purgeExpired();
  if (action === 'list') {
    const offset = Number.isInteger(input.offset) && input.offset >= 0 ? Math.min(input.offset, 100000) : 0;
    const status = ['pending', 'approved', 'rejected'].includes(input.status) ? input.status : 'pending';
    const rows = await db('student_requests' + query({select: selectStudent + ',file_type,applicant_name', status: 'eq.' + status,
      order: 'created_at.desc,id.desc', limit: '21', offset: String(offset)}));
    return {items: rows.slice(0, 20), more: rows.length > 20};
  }
  const id = uuid(input.id);
  const [request] = await db('student_requests' + query({id: 'eq.' + id}));
  if (!request) throw new Problem(404, 'Cererea nu a fost găsită.');
  const expired = new Date(request.expires_at) <= new Date();
  if (action === 'proof') {
    if (!request.file_type || expired) throw new Problem(404, 'Documentul justificativ nu mai este disponibil.');
    return {binary: await storage(proofs, id, 'GET'), type: request.file_type};
  }
  if (action === 'decide') {
    if (request.status !== 'pending' || expired) throw new Problem(409, 'Cererea a fost deja soluționată sau a expirat.');
    const status = input.status;
    if (!['approved', 'rejected'].includes(status)) throw new Problem(400, 'Alege o decizie validă.');
    const reason = status === 'rejected' ? textField(input.reason, 500, 'Motivul respingerii') : null;
    const now = new Date().toISOString();
    const rows = await db('student_requests' + query({id: 'eq.' + id, status: 'eq.pending',
      expires_at: 'gt.' + now}), 'PATCH', {status, reason, reviewed_at: now, reviewed_by: user.id});
    if (!rows.length) throw new Problem(409, 'Cererea a fost deja soluționată sau a expirat.');
    return {message: 'Decizia a fost salvată.'};
  }
  if (request.status === 'pending' && !expired) throw new Problem(409, 'Înregistrează decizia înainte să ștergi documentul.');
  if (expired) await rejectExpired(request);
  await removeProof(request);
  return {message: 'Documentul justificativ a fost șters.'};
}
