import { randomUUID } from 'node:crypto';
import { dayKey, db, documents, generate, hasAI, Problem, query, rpc, storage, textField, uploaded,
  uuid, validateAction } from './services.js';

const mine = (user, id) => query({user_id: 'eq.' + user.id, id: 'eq.' + uuid(id)});
const get = async (user, id) => {
  const [doc] = await db('documents' + mine(user, id));
  if (!doc) throw new Problem(404, 'Documentul nu a fost găsit.');
  return doc;
};

export async function notebook(action, user, input) {
  if (action === 'list') {
    const search = typeof input.search === 'string' ? input.search.trim().slice(0, 120) : '';
    const offset = Number.isInteger(input.offset) && input.offset >= 0 ? Math.min(input.offset, 100000) : 0;
    const items = await rpc('find_documents', {p_user: user.id, p_search: search, p_offset: offset});
    return {items: items.slice(0, 20), more: items.length > 20};
  }
  if (action === 'add') {
    const id = randomUUID();
    const title = textField(input.title, 120, 'Titlul');
    const subject = textField(input.subject, 60, 'Materia');
    const file = input.kind === 'file' ? uploaded(input.file) : null;
    const note = file ? null : textField(input.note, 24000, 'Notița');
    if (file) await storage(documents, id, 'POST', file);
    try {
      await db('documents', 'POST', {id, user_id: user.id, title, subject, note, file_type: file?.type || null});
    } catch (error) {
      if (file) await storage(documents, id, 'DELETE').catch(() => {});
      throw error;
    }
    return {id};
  }
  if (action === 'get') {
    const {id, title, subject, note, file_type, created_at, outputs, deleting} = await get(user, input.id);
    return {id, title, subject, note, file_type, created_at, outputs, deleting};
  }
  if (action === 'original') {
    const doc = await get(user, input.id);
    if (!doc.file_type || doc.deleting) throw new Problem(404, 'Fișierul nu este disponibil.');
    return {binary: await storage(documents, doc.id, 'GET'), type: doc.file_type};
  }
  if (action === 'delete') {
    const id = uuid(input.id);
    const kind = await rpc('mark_document_deleting', {p_user: user.id, p_document: id});
    if (kind === 'busy') throw new Problem(409, 'Așteaptă să se încheie procesarea documentului.');
    if (kind !== 'missing' && kind !== 'note') await storage(documents, id, 'DELETE');
    await db('documents' + mine(user, id), 'DELETE');
    return {};
  }
  const id = uuid(input.id);
  validateAction(input.action);
  if (!hasAI) throw new Problem(503, 'Procesarea AI așteaptă configurarea serviciului. Documentul rămâne salvat.');
  const token = randomUUID();
  const reserved = await rpc('begin_processing', {
    p_user: user.id, p_document: id, p_day: dayKey(), p_action: input.action, p_token: token
  });
  if (reserved.status === 'missing') throw new Problem(404, 'Documentul nu a fost găsit.');
  if (reserved.status === 'busy') throw new Problem(409, 'Documentul este deja în curs de procesare.');
  if (reserved.status === 'limit') throw new Problem(429, 'Ai atins limita de documente pentru azi. Poți reveni mâine sau alege un plan cu o limită mai mare.');
  if (reserved.status === 'cached') return {output: reserved.output};
  const finish = output => rpc('finish_processing', {
    p_user: user.id, p_document: id, p_token: token, p_action: input.action, p_output: output
  });
  try {
    const output = await generate(input.action, reserved, id);
    if (!await finish(output)) throw new Problem(409, 'Sesiunea de procesare a expirat. Încearcă din nou.');
    return {output};
  } catch (error) {
    await finish(null).catch(() => {});
    if (error instanceof Problem) throw error;
    throw new Problem(502, 'Serviciul AI nu a putut procesa documentul. Încearcă din nou.');
  }
}
