import { EmailMessage } from 'cloudflare:email';

const sender = 'pescurt@ro-mihaiu.xyz';
const destination = 'pescurt.info@gmail.com';
function encode(text) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text))).match(/.{1,76}/g).join('\r\n');
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || request.headers.get('Authorization') !== 'Bearer ' + env.RELAY_KEY)
      return new Response(null, {status: 403});
    const {email, message} = await request.json();
    if (typeof email !== 'string' || email.length > 254 || typeof message !== 'string' || message.length > 3000)
      return new Response(null, {status: 400});
    const body = [
      'From: PeScurt <' + sender + '>', 'To: ' + destination,
      'Subject: Reclamatie PeScurt', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64', '', encode('Adresă de răspuns: ' + email + '\n\n' + message)
    ].join('\r\n');
    try {
      await env.MAIL.send(new EmailMessage(sender, destination, body));
      return new Response(null, {status: 204});
    } catch {
      return new Response(null, {status: 502});
    }
  }
};
