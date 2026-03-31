import Stripe from 'stripe';
import { env, assertLiveMoneyAllowed } from '../config/env.js';
import { pool } from '../db/pool.js';
import { creditWallet } from './walletService.js';

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

export async function createCheckoutSession(userId) {
  assertLiveMoneyAllowed();
  if (!stripe) throw Object.assign(new Error('Stripe is not configured'), { statusCode: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: env.stripePriceId, quantity: 1 }],
    success_url: `${env.appBaseUrl}/payments/success`,
    cancel_url: `${env.appBaseUrl}/payments/cancel`,
    metadata: { userId }
  });

  return session;
}

export async function handleStripeWebhook(signature, rawBody) {
  assertLiveMoneyAllowed();
  if (!stripe) throw Object.assign(new Error('Stripe is not configured'), { statusCode: 500 });

  const event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);

  const existing = await pool.query(`SELECT id FROM payment_events WHERE event_id = $1`, [event.id]);
  if (existing.rows[0]) {
    return { duplicate: true };
  }

  await pool.query(
    `INSERT INTO payment_events (provider, event_id, event_type, payload)
     VALUES ('stripe', $1, $2, $3)`,
    [event.id, event.type, event]
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId) {
      const amountTotal = Number(session.amount_total || 0);
      await creditWallet(userId, amountTotal, session.id, { stripeSessionId: session.id });
    }
  }

  return { duplicate: false, type: event.type };
}
