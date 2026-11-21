import { Problem, rpc, textField } from './services.js';

export async function submitComplaint(user, input) {
  const message = textField(input.message, 3000, 'Mesajul', 10);
  const secret = process.env.COMPLAINT_RELAY_KEY;
  if (!secret) throw new Problem(503, 'Formularul este indisponibil. Scrie la pescurt.info@gmail.com.');
  if (!await rpc('consume_auth_limit', {p_key:'complaint:' + user.id, p_limit:3, p_seconds:3600}))
    throw new Problem(429, 'Poți trimite până la trei reclamații pe oră.');
  try {
    const response = await fetch('https://pescurt-reclamatii.mihaicpm75.workers.dev', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer ' + secret, 'Content-Type':'application/json'},
      body:JSON.stringify({email:user.email, message})
    });
    if (response.status !== 204) throw new Error();
  } catch {
    throw new Problem(502, 'Nu am putut confirma expedierea. Poți scrie direct la pescurt.info@gmail.com.');
  }
  return {message:'Reclamația a fost transmisă serviciului de email. Îți putem răspunde la adresa contului.'};
}
