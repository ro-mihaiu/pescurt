import { db, Problem, query } from './services.js';

export const policyVersion = '2026-11-21';
export function requireAcknowledgement(input) {
  if (input.policy !== policyVersion) throw new Problem(400, 'Citește informarea și bifează căsuța pentru a continua.');
}
export async function hasAcknowledged(userId) {
  const rows = await db('policy_acknowledgements' + query({select:'version', user_id:'eq.' + userId, version:'eq.' + policyVersion, limit:1}));
  return rows.length > 0;
}
export async function acknowledge(userId, input) {
  requireAcknowledgement(input);
  await db('policy_acknowledgements', 'POST', {user_id:userId, version:policyVersion}, 'resolution=ignore-duplicates,return=minimal');
  return {accepted:true};
}
