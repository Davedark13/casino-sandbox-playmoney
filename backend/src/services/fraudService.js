import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { sendAlert } from './alertService.js';
import { writeAuditLog } from './auditService.js';

async function loadRiskMetrics(userId) {
  const [txResult, walletResult, userResult, flagResult] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS tx_last_hour,
         COUNT(*) FILTER (WHERE type = 'deposit' AND created_at > NOW() - INTERVAL '24 hours') AS deposits_24h,
         COALESCE(SUM(amount_cents) FILTER (WHERE type = 'payout' AND created_at > NOW() - INTERVAL '24 hours'), 0) AS payout_24h,
         COALESCE(SUM(amount_cents) FILTER (WHERE type = 'wager' AND created_at > NOW() - INTERVAL '24 hours'), 0) AS wager_24h,
         COALESCE(SUM(amount_cents) FILTER (WHERE type = 'withdrawal' AND created_at > NOW() - INTERVAL '24 hours'), 0) AS withdraw_24h
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    ),
    pool.query(`SELECT balance_cents FROM wallets WHERE user_id = $1`, [userId]),
    pool.query(`SELECT is_blocked, risk_score FROM users WHERE id = $1`, [userId]),
    pool.query(
      `SELECT COALESCE(SUM(score_delta), 0) AS active_flag_score
       FROM user_flags
       WHERE user_id = $1 AND resolved = FALSE`,
      [userId]
    )
  ]);

  return {
    tx: txResult.rows[0],
    wallet: walletResult.rows[0],
    user: userResult.rows[0],
    flagScore: Number(flagResult.rows[0]?.active_flag_score || 0)
  };
}

function computeBaseRisk({ tx, wallet }) {
  const txLastHour = Number(tx.tx_last_hour || 0);
  const deposits24h = Number(tx.deposits_24h || 0);
  const payout24h = Number(tx.payout_24h || 0);
  const wager24h = Number(tx.wager_24h || 0);
  const withdraw24h = Number(tx.withdraw_24h || 0);
  const balance = Number(wallet?.balance_cents || 0);

  let riskScore = 0;
  if (txLastHour > 25) riskScore += 25;
  if (deposits24h > 6) riskScore += 15;
  if (withdraw24h > 200000) riskScore += 20;
  if (payout24h > wager24h * 3 && payout24h > 100000) riskScore += 35;
  if (balance > 500000) riskScore += 15;
  if (wager24h === 0 && payout24h > 0) riskScore += 20;

  return {
    riskScore,
    txLastHour,
    deposits24h,
    payout24h,
    wager24h,
    withdraw24h,
    balance
  };
}

export async function evaluateUserRisk(userId) {
  const metrics = await loadRiskMetrics(userId);
  const derived = computeBaseRisk(metrics);
  const riskScore = Math.min(100, derived.riskScore + metrics.flagScore);

  await pool.query(`UPDATE users SET risk_score = $2, updated_at = NOW() WHERE id = $1`, [userId, riskScore]);

  if (riskScore >= env.riskAutoblockThreshold && !metrics.user?.is_blocked) {
    const existingAutoBlock = await pool.query(
      `SELECT id FROM user_flags
       WHERE user_id = $1 AND flag_type = 'auto_block' AND resolved = FALSE
       LIMIT 1`,
      [userId]
    );
    await pool.query(
      `UPDATE users
       SET is_blocked = TRUE, block_reason = 'Auto-blocked by risk engine', updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    if (!existingAutoBlock.rows[0]) {
      await pool.query(
        `INSERT INTO user_flags (user_id, flag_type, severity, score_delta, details)
         VALUES ($1, 'auto_block', 'critical', 0, $2)`,
        [userId, derived]
      );
    }
    await writeAuditLog('system', 'risk-engine', 'user.auto_blocked', userId, { riskScore, derived });
    await sendAlert('User auto-blocked', `user=${userId} riskScore=${riskScore}`, 'critical');
  } else if (riskScore >= 60) {
    const existingSuspicious = await pool.query(
      `SELECT id FROM user_flags
       WHERE user_id = $1 AND flag_type = 'suspicious_activity' AND resolved = FALSE
       LIMIT 1`,
      [userId]
    );
    if (!existingSuspicious.rows[0]) {
      await pool.query(
        `INSERT INTO user_flags (user_id, flag_type, severity, score_delta, details)
         VALUES ($1, 'suspicious_activity', 'high', 0, $2)`,
        [userId, derived]
      );
      await writeAuditLog('system', 'risk-engine', 'user.suspicious_activity', userId, { riskScore, derived });
      await sendAlert('Suspicious activity', `user=${userId} riskScore=${riskScore}`, 'high');
    }
  }

  return {
    userId,
    riskScore,
    activeFlagScore: metrics.flagScore,
    ...derived
  };
}

export async function flagUserRisk(userId, { flagType, severity = 'high', scoreDelta = 10, details = {} }) {
  await pool.query(
    `INSERT INTO user_flags (user_id, flag_type, severity, score_delta, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, flagType, severity, scoreDelta, details]
  );
  await writeAuditLog('system', 'risk-engine', `risk.${flagType}`, userId, { severity, scoreDelta, details });
  if (severity === 'high' || severity === 'critical') {
    await sendAlert('Risk signal raised', `user=${userId} flag=${flagType} scoreDelta=${scoreDelta}`, severity);
  }
  return evaluateUserRisk(userId);
}

export async function listFraudSnapshots(limit = 50) {
  const result = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.email,
       u.risk_score,
       u.is_blocked,
       u.block_reason,
       COALESCE(json_agg(json_build_object(
         'id', uf.id,
         'flagType', uf.flag_type,
         'severity', uf.severity,
         'scoreDelta', uf.score_delta,
         'details', uf.details,
         'createdAt', uf.created_at
       ) ORDER BY uf.created_at DESC) FILTER (WHERE uf.id IS NOT NULL), '[]') AS flags
     FROM users u
     LEFT JOIN user_flags uf ON uf.user_id = u.id AND uf.resolved = FALSE
     GROUP BY u.id
     ORDER BY u.risk_score DESC, u.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
