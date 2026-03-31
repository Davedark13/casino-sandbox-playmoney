import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { appendLedger, createTransaction } from './walletService.js';
import { writeAuditLog } from './auditService.js';
import { evaluateUserRisk } from './fraudService.js';
import { fairRoll } from '../utils/rng.js';

function ensureSandboxGameMode() {
  if (env.appMode !== 'test') {
    throw Object.assign(new Error('Demo game rounds are only available in APP_MODE=test'), { statusCode: 403 });
  }
}

export async function playDemoRound(userId, amountCents, idempotencyKey, metadata = {}) {
  ensureSandboxGameMode();
  if (!idempotencyKey) {
    throw Object.assign(new Error('Missing idempotency-key header'), { statusCode: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw Object.assign(new Error('Bet amount must be positive'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRound = await client.query(
      `SELECT * FROM game_rounds WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey]
    );
    if (existingRound.rows[0]) {
      await client.query('COMMIT');
      return existingRound.rows[0];
    }

    const userResult = await client.query(`SELECT is_blocked FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const walletResult = await client.query(`SELECT balance_cents FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
    const user = userResult.rows[0];
    const wallet = walletResult.rows[0];

    if (!user || !wallet) {
      throw Object.assign(new Error('User wallet not found'), { statusCode: 404 });
    }
    if (user.is_blocked) {
      throw Object.assign(new Error('User is blocked'), { statusCode: 403 });
    }
    if (Number(wallet.balance_cents) < amountCents) {
      throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });
    }

    const roll = fairRoll(10_000);
    const payoutMultiplier = roll.value >= 9_800 ? 5 : roll.value >= 5_250 ? 2 : 0;
    const payoutCents = amountCents * payoutMultiplier;
    const nextBalance = Number(wallet.balance_cents) - amountCents + payoutCents;

    const wagerTx = await createTransaction(client, userId, 'wager', amountCents, 'completed', `${idempotencyKey}:bet`, {
      source: 'demo-round',
      ...metadata
    });
    await appendLedger(client, userId, wagerTx.id, 'demo_bet', -amountCents, Number(wallet.balance_cents) - amountCents);

    let payoutTxId = null;
    if (payoutCents > 0) {
      const payoutTx = await createTransaction(client, userId, 'payout', payoutCents, 'completed', `${idempotencyKey}:win`, {
        source: 'demo-round',
        ...metadata
      });
      payoutTxId = payoutTx.id;
      await appendLedger(client, userId, payoutTx.id, 'demo_win', payoutCents, nextBalance);
    }

    await client.query(
      `UPDATE wallets
       SET balance_cents = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, nextBalance]
    );

    const roundResult = await client.query(
      `INSERT INTO game_rounds (
         user_id,
         idempotency_key,
         bet_amount_cents,
         payout_amount_cents,
         rng_value,
         proof,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, idempotencyKey, amountCents, payoutCents, roll.value, roll.proof, metadata]
    );

    await client.query('COMMIT');
    await writeAuditLog('user', userId, 'game.demo_round_played', roundResult.rows[0].id, {
      amountCents,
      payoutCents,
      wagerTxId: wagerTx.id,
      payoutTxId
    });
    await evaluateUserRisk(userId);
    return roundResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const existing = await pool.query(`SELECT * FROM game_rounds WHERE idempotency_key = $1 LIMIT 1`, [idempotencyKey]);
      if (existing.rows[0]) {
        return existing.rows[0];
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
