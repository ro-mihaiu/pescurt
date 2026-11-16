import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl, db, hasBilling, Problem, provider, query, rpc, uuid } from './services.js';

const env = process.env;
const priceIds = {
  monthly: env.STRIPE_MONTHLY_PRICE_ID,
  yearly: env.STRIPE_YEARLY_PRICE_ID,
  student: env.STRIPE_STUDENT_PRICE_ID,
  lifetime: env.STRIPE_LIFETIME_PRICE_ID
};

async function stripe(path, fields, idempotency) {
  const response = await provider('https://api.stripe.com/v1/' + path, {
    method: fields ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Stripe-Version': '2025-06-30.basil',
      ...(fields ? {'Content-Type': 'application/x-www-form-urlencoded'} : {}),
      ...(idempotency ? {'Idempotency-Key': idempotency} : {})
    },
    body: fields ? new URLSearchParams(fields) : undefined
  });
  return response.json();
}

function validPrice(plan, price) {
  const recurring = price.recurring;
  return price.active && Number.isInteger(price.unit_amount) && price.unit_amount > 0 &&
    (plan === 'lifetime' ? price.type === 'one_time' :
      recurring?.usage_type === 'licensed' && (plan === 'student' ||
        (recurring.interval_count === 1 && recurring.interval === (plan === 'yearly' ? 'year' : 'month'))));
}

let priceCache;
export async function prices() {
  if (!hasBilling) return {};
  if (priceCache && priceCache.expires > Date.now()) return priceCache.prices;
  const entries = Object.entries(priceIds).filter(([, id]) => id);
  const results = await Promise.allSettled(entries.map(async ([plan, id]) => {
    const price = await stripe('prices/' + encodeURIComponent(id));
    if (!validPrice(plan, price)) return [];
    const intl = new Intl.NumberFormat('ro-RO', {style: 'currency', currency: price.currency});
    const exponent = intl.resolvedOptions().maximumFractionDigits;
    const stripeExponent = ['isk', 'ugx'].includes(price.currency) ? 2 : exponent;
    const amount = price.unit_amount / 10 ** stripeExponent;
    return [[plan, {amount: intl.format(amount), interval: price.recurring?.interval, count: price.recurring?.interval_count}]];
  }));
  const available = Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? result.value : []));
  priceCache = {prices: available, expires: Date.now() + 60000};
  return available;
}

const customerOf = async userId => (await db('billing_customers' + query({user_id: 'eq.' + userId})))?.[0]?.customer_id;

async function ensureCustomer(user) {
  const existing = await customerOf(user.id);
  if (existing) return existing;
  const customer = await stripe('customers', {email: user.email, 'metadata[user_id]': user.id}, 'pescurt-customer-' + user.id);
  await db('billing_customers', 'POST', {user_id: user.id, customer_id: customer.id},
    'return=minimal,resolution=ignore-duplicates');
  return await customerOf(user.id);
}

export async function billing(action, user, input) {
  if (!hasBilling) throw new Problem(503, 'Plățile și gestionarea abonamentului așteaptă configurarea Stripe.');
  if (action === 'portal') {
    const customer = await customerOf(user.id);
    if (!customer) throw new Problem(404, 'Contul tău nu are încă un profil de facturare.');
    const portal = await stripe('billing_portal/sessions', {customer, return_url: appUrl + '/profil'});
    return {url: portal.url};
  }
  const plan = input.plan;
  if (!Object.hasOwn(priceIds, plan) || !priceIds[plan] || !(await prices())[plan]) {
    throw new Problem(503, 'Tariful acestui plan nu este disponibil.');
  }
  if (plan === 'student') {
    const approved = await db('student_requests' + query({user_id: 'eq.' + user.id, status: 'eq.approved', limit: '1'}));
    if (!approved.length) throw new Problem(403, 'Poți alege tariful de elev/student după aprobarea cererii.');
  }
  if (await rpc('current_plan', {p_user: user.id}) !== 'free') {
    throw new Problem(409, 'Ai deja un plan activ. Verifică opțiunile din portalul de facturare.');
  }
  const customer = await ensureCustomer(user);
  const subscriptions = await stripe('subscriptions' + query({customer, status: 'all', limit: '100'}));
  if (subscriptions.data.some(item => ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'].includes(item.status))) {
    throw new Problem(409, 'Ai deja un abonament în Stripe. Verifică-l în portalul de facturare.');
  }
  const sessions = await stripe('checkout/sessions' + query({customer, status: 'open', limit: '10'}));
  const existing = sessions.data[0];
  if (existing) {
    if (existing.metadata?.plan === plan && existing.url) return {url: existing.url};
    throw new Problem(409, 'Ai deja o plată deschisă pentru alt plan. Finalizeaz-o sau revino după expirarea sesiunii.');
  }
  const session = await stripe('checkout/sessions', {
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    customer,
    client_reference_id: user.id,
    'line_items[0][price]': priceIds[plan],
    'line_items[0][quantity]': '1',
    'metadata[plan]': plan,
    ...(plan === 'lifetime' ? {'payment_intent_data[metadata][pescurt_lifetime]': 'true'} : {}),
    locale: 'ro',
    success_url: appUrl + '/profil?plata=asteptare',
    cancel_url: appUrl + '/preturi'
  }, 'pescurt-checkout-' + user.id + '-' + Math.floor(Date.now() / 300000));
  return {url: session.url};
}

export function validSignature(raw, signature, secret, now = Date.now()) {
  if (!signature || !secret) return false;
  const fields = signature.split(',').map(field => field.trim().split('='));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const signed = createHmac('sha256', secret).update(timestamp + '.').update(raw).digest();
  return fields.some(([key, hex]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(hex || '') &&
    timingSafeEqual(signed, Buffer.from(hex, 'hex')));
}

async function ownerOf(customer) {
  return (await db('billing_customers' + query({customer_id: 'eq.' + customer})))?.[0]?.user_id;
}

function saveEntitlement(id, user, plan, active, expires, observed) {
  return rpc('sync_entitlement', {p_id: id, p_user: user, p_plan: plan, p_active: active,
    p_expires: expires, p_observed: observed});
}

export async function webhook(raw, signature) {
  if (!hasBilling) throw new Problem(503, 'Stripe nu este configurat.');
  if (!validSignature(raw, signature, env.STRIPE_WEBHOOK_SECRET)) throw new Problem(400, 'Semnătură Stripe invalidă.');
  const event = JSON.parse(raw.toString('utf8'));
  const item = event.data.object;
  const dispute = event.type.startsWith('charge.dispute.');
  const chargeEvent = dispute && item.charge ? await stripe('charges/' + encodeURIComponent(item.charge)) : null;
  const customer = item.customer || chargeEvent?.customer;
  const userId = customer && await ownerOf(customer);
  if (!userId) return {received: true};
  uuid(userId);
  const observed = new Date().toISOString();
  if (event.type.startsWith('customer.subscription.')) {
    const latest = await stripe('subscriptions/' + encodeURIComponent(item.id));
    for (const line of latest.items.data) {
      const plan = ['monthly', 'yearly', 'student'].find(name => priceIds[name] === line.price.id);
      if (!plan) continue;
      const active = ['active', 'trialing'].includes(latest.status) && !!line.current_period_end;
      const expiry = active ? new Date(line.current_period_end * 1000).toISOString() : null;
      await saveEntitlement(latest.id, userId, plan, active, expiry, observed);
      return {received: true};
    }
    await db('entitlements' + query({stripe_id: 'eq.' + item.id, user_id: 'eq.' + userId,
      observed_at: 'lte.' + observed}), 'PATCH', {active: false, observed_at: observed});
  } else if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'charge.refunded',
    'charge.dispute.created', 'charge.dispute.closed'].includes(event.type)) {
    const intentId = item.payment_intent || chargeEvent?.payment_intent;
    if (!intentId) return {received: true};
    const intent = await stripe('payment_intents/' + encodeURIComponent(intentId) + '?expand[]=latest_charge');
    if (intent.metadata?.pescurt_lifetime !== 'true' || intent.customer !== customer) return {received: true};
    const checkouts = await stripe('checkout/sessions' + query({payment_intent: intentId, limit: '1'}));
    const checkout = checkouts.data[0];
    if (checkout?.client_reference_id !== userId || checkout.payment_status !== 'paid') return {received: true};
    const lines = await stripe('checkout/sessions/' + encodeURIComponent(checkout.id) + '/line_items');
    if (!lines.data.some(line => line.price?.id === priceIds.lifetime)) return {received: true};
    const charge = intent.latest_charge;
    let disputeResolved = !charge?.disputed;
    if (charge?.disputed) {
      const disputes = await stripe('disputes' + query({charge: charge.id, limit: '1'}));
      disputeResolved = ['won', 'warning_closed'].includes(disputes.data[0]?.status);
    }
    const active = intent.status === 'succeeded' && !!charge && !charge.refunded && disputeResolved;
    await saveEntitlement(intentId, userId, 'lifetime', active, null, observed);
  }
  return {received: true};
}
