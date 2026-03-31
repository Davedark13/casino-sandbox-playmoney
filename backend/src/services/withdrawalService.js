import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { appendLedger, createTransaction } from './walletService.js';
import { writeAuditLog } from './auditService.js';
import { evaluateUserRisk } from './fraudService.js';

export async function requestWithdrawal(userId, amountCents, idempotencyKey, destinationMetadata = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!idempotencyKey) {
      throw Object.assign(new Error('Missing idempotency-key header'), { statusCode: 400 });
    }

    const existing = await client.query(`SELECT * FROM withdrawals WHERE idempotency_key = $1`, [idempotencyKey]);
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return existing.rows[0];
    }

    // Keep transactional reads on a single client sequential to avoid deprecated
    // concurrent client.query() usage in pg.
    const userResult = await client.query(`SELECT is_blocked, risk_score FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const walletResult = await client.query(`SELECT balance_cents, locked_balance_cents FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
    const existingAfterLock = await client.query(`SELECT * FROM withdrawals WHERE idempotency_key = $1`, [idempotencyKey]);
    if (existingAfterLock.rows[0]) {
      await client.query('COMMIT');
      return existingAfterLock.rows[0];
    }

    const kycResult = await client.query(`SELECT status FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
    const recentWithdrawalResult = await client.query(
      `SELECT requested_at FROM withdrawals
       WHERE user_id = $1
       ORDER BY requested_at DESC
       LIMIT 1`,
      [userId]
    );
    const dailyTotalResult = await client.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM withdrawals
       WHERE user_id = $1 AND requested_at::date = CURRENT_DATE`,
      [userId]
    );

    const user = userResult.rows[0];
    const wallet = walletResult.rows[0];
    const kyc = kycResult.rows[0];
    const lastWithdrawal = recentWithdrawalResult.rows[0];
    const dailyTotal = Number(dailyTotalResult.rows[0].total || 0);

    if (user.is_blocked) throw Object.assign(new Error('User is blocked'), { statusCode: 403 });
    if (!kyc || kyc.status !== 'verified') throw Object.assign(new Error('KYC verification required'), { statusCode: 403 });
    if (amountCents <= 0) throw Object.assign(new Error('Withdrawal amount must be positive'), { statusCode: 400 });

    const availableBalance = Number(wallet.balance_cents) - Number(wallet.locked_balance_cents);
    if (availableBalance < amountCents) throw Object.assign(new Error('Insufficient available balance'), { statusCode: 400 });

    if (dailyTotal + amountCents > env.withdrawDailyLimitCents) {
      throw Object.assign(new Error('Daily withdrawal limit exceeded'), { statusCode: 400 });
    }

    if (lastWithdrawal?.requested_at) {
      const cooldownEndsAt = new Date(lastWithdrawal.requested_at);
      cooldownEndsAt.setMinutes(cooldownEndsAt.getMinutes() + env.withdrawCooldownMinutes);
      if (cooldownEndsAt > new Date()) {
        throw Object.assign(new Error('Withdrawal cooldown active'), { statusCode: 429 });
      }
    }

    const tx = await createTransaction(client, userId, 'withdrawal', amountCents, 'pending', idempotencyKey, destinationMetadata);
    const withdrawalResult = await client.query(
      `INSERT INTO withdrawals (user_id, amount_cents, status, idempotency_key, destination_metadata)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING *`,
      [userId, amountCents, idempotencyKey, destinationMetadata]
    );

    const nextLockedBalance = Number(wallet.locked_balance_cents) + amountCents;
    await client.query(
      `UPDATE wallets
       SET locked_balance_cents = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, nextLockedBalance]
    );
    await appendLedger(client, userId, tx.id, 'lock_withdrawal', -amountCents, Number(wallet.balance_cents) - nextLockedBalance);
    await writeAuditLog('user', userId, 'withdrawal.requested', withdrawalResult.rows[0].id, { amountCents });
    await client.query('COMMIT');
    return withdrawalResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const existing = await pool.query(`SELECT * FROM withdrawals WHERE idempotency_key = $1`, [idempotencyKey]);
      if (existing.rows[0]) {
        return existing.rows[0];
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewWithdrawal(withdrawalId, adminAction, adminNote, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!['approve', 'reject'].includes(adminAction)) {
      throw Object.assign(new Error('Invalid admin action'), { statusCode: 400 });
    }
    const withdrawalResult = await client.query(`SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId]);
    const withdrawal = withdrawalResult.rows[0];
    if (!withdrawal) throw Object.assign(new Error('Withdrawal not found'), { statusCode: 404 });
    if (!['pending', 'requested'].includes(withdrawal.status)) {
      throw Object.assign(new Error('Withdrawal is not reviewable'), { statusCode: 400 });
    }

    const walletResult = await client.query(`SELECT balance_cents, locked_balance_cents FROM wallets WHERE user_id = $1 FOR UPDATE`, [withdrawal.user_id]);
    const wallet = walletResult.rows[0];
    const txResult = await client.query(
      `SELECT id FROM transactions WHERE reference = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [withdrawal.idempotency_key, withdrawal.user_id]
    );
    const txId = txResult.rows[0]?.id;

    if (adminAction === 'approve') {
      const nextBalance = Number(wallet.balance_cents) - Number(withdrawal.amount_cents);
      const nextLocked = Number(wallet.locked_balance_cents) - Number(withdrawal.amount_cents);
      await client.query(
        `UPDATE wallets
         SET balance_cents = $2, locked_balance_cents = $3, updated_at = NOW()
         WHERE user_id = $1`,
        [withdrawal.user_id, nextBalance, nextLocked]
      );
      await client.query(
        `UPDATE withdrawals
         SET status = 'approved', reviewed_at = NOW(), admin_note = $2
         WHERE id = $1`,
        [withdrawalId, adminNote]
      );
      await client.query(`UPDATE transactions SET status = 'completed' WHERE id = $1`, [txId]);
      await appendLedger(client, withdrawal.user_id, txId, 'withdrawal_approved', -Number(withdrawal.amount_cents), nextBalance);
    } else {
      const nextLocked = Number(wallet.locked_balance_cents) - Number(withdrawal.amount_cents);
      await client.query(
        `UPDATE wallets
         SET locked_balance_cents = $2, updated_at = NOW()
         WHERE user_id = $1`,
        [withdrawal.user_id, nextLocked]
      );
      await client.query(
        `UPDATE withdrawals
         SET status = 'rejected', reviewed_at = NOW(), admin_note = $2
         WHERE id = $1`,
        [withdrawalId, adminNote]
      );
      await client.query(`UPDATE transactions SET status = 'failed' WHERE id = $1`, [txId]);
      await appendLedger(client, withdrawal.user_id, txId, 'withdrawal_released', Number(withdrawal.amount_cents), Number(wallet.balance_cents));
    }

    await writeAuditLog('admin', adminId, `withdrawal.${adminAction}`, withdrawalId, { adminNote });
    await client.query('COMMIT');
    await evaluateUserRisk(withdrawal.user_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
