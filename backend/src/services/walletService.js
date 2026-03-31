import { pool } from '../db/pool.js';

export async function getWallet(userId) {
  const result = await pool.query(
    `SELECT user_id, balance_cents, locked_balance_cents, updated_at
     FROM wallets WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function createTransaction(client, userId, type, amountCents, status, reference, metadata = {}) {
  const result = await client.query(
    `INSERT INTO transactions (user_id, type, amount_cents, status, reference, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, amountCents, status, reference, metadata]
  );
  return result.rows[0];
}

export async function appendLedger(client, userId, transactionId, entryType, amountCents, balanceAfterCents) {
  await client.query(
    `INSERT INTO ledger_entries (user_id, transaction_id, entry_type, amount_cents, balance_after_cents)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, transactionId, entryType, amountCents, balanceAfterCents]
  );
}

export async function creditWallet(userId, amountCents, reference, metadata = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const walletResult = await client.query(`SELECT balance_cents FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
    const currentBalance = Number(walletResult.rows[0]?.balance_cents || 0);
    if (reference) {
      const existingResult = await client.query(
        `SELECT
           t.*,
           le.balance_after_cents
         FROM transactions t
         LEFT JOIN ledger_entries le ON le.transaction_id = t.id
         WHERE t.user_id = $1
           AND t.type = 'deposit'
           AND t.reference = $2
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [userId, reference]
      );
      if (existingResult.rows[0]) {
        await client.query('COMMIT');
        return {
          transaction: existingResult.rows[0],
          balanceCents: Number(existingResult.rows[0].balance_after_cents ?? currentBalance)
        };
      }
    }
    const nextBalance = currentBalance + amountCents;
    const tx = await createTransaction(client, userId, 'deposit', amountCents, 'completed', reference, metadata);
    await client.query(`UPDATE wallets SET balance_cents = $2, updated_at = NOW() WHERE user_id = $1`, [userId, nextBalance]);
    await appendLedger(client, userId, tx.id, 'credit', amountCents, nextBalance);
    await client.query('COMMIT');
    return { transaction: tx, balanceCents: nextBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
