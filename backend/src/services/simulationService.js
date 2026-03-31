import crypto from 'crypto';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { writeAuditLog } from './auditService.js';
import { playDemoRound } from './gameService.js';
import { creditWallet } from './walletService.js';
import { requestWithdrawal } from './withdrawalService.js';
import { flagUserRisk } from './fraudService.js';

function ensureTestMode() {
  if (env.appMode !== 'test') {
    throw Object.assign(new Error('Stress simulations are only available in APP_MODE=test'), { statusCode: 403 });
  }
}

async function getSandboxUsers(limit = 10) {
  const result = await pool.query(
    `SELECT u.id, u.username, w.balance_cents
     FROM users u
     JOIN wallets w ON w.user_id = u.id
     WHERE u.mode = 'test'
     ORDER BY u.created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function ensureUserReady(userId, minBalanceCents = 20_000) {
  const walletResult = await pool.query(`SELECT balance_cents FROM wallets WHERE user_id = $1`, [userId]);
  const balance = Number(walletResult.rows[0]?.balance_cents || 0);
  if (balance < minBalanceCents) {
    await creditWallet(userId, minBalanceCents - balance + 5_000, `sim-topup-${userId}-${Date.now()}`, {
      source: 'stress-simulation'
    });
  }

  const kycResult = await pool.query(
    `SELECT status FROM kyc_documents
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (kycResult.rows[0]?.status !== 'verified') {
    await pool.query(
      `INSERT INTO kyc_documents (user_id, status, document_type, storage_path, reviewer_note, reviewed_at)
       VALUES ($1, 'verified', 'simulated', '/stress/verified.png', 'Auto-verified for test mode', NOW())`,
      [userId]
    );
  }

  await pool.query(
    `UPDATE withdrawals
     SET requested_at = NOW() - INTERVAL '2 hours'
     WHERE user_id = $1 AND status IN ('requested', 'pending', 'approved')`,
    [userId]
  );
}

async function simulateConcurrentBets(users, iterations) {
  await Promise.all(users.map((user) => ensureUserReady(user.id, 40_000)));
  const operations = Array.from({ length: iterations }).map((_, index) => {
    const user = users[index % users.length];
    const amountCents = 500 + (index % 5) * 250;
    return playDemoRound(user.id, amountCents, `stress-bet-${Date.now()}-${index}`, {
      scenario: 'concurrent_bets'
    });
  });

  const results = await Promise.allSettled(operations);
  return {
    successCount: results.filter((item) => item.status === 'fulfilled').length,
    errorCount: results.filter((item) => item.status === 'rejected').length,
    sample: results.slice(0, 5).map((item) => (
      item.status === 'fulfilled'
        ? { id: item.value.id, payout: item.value.payout_amount_cents, proof: item.value.proof }
        : { error: item.reason?.message || 'unknown error' }
    ))
  };
}

async function simulateWithdrawRace(users, iterations) {
  const user = users[0];
  await ensureUserReady(user.id, 80_000);
  const idempotencyKey = `stress-withdraw-race-${crypto.randomUUID()}`;
  const operations = Array.from({ length: iterations }).map(() => (
    requestWithdrawal(user.id, 5_000, idempotencyKey, { scenario: 'withdraw_race' })
  ));

  const results = await Promise.allSettled(operations);
  const successful = results.filter((item) => item.status === 'fulfilled');
  const uniqueIds = [...new Set(successful.map((item) => item.value.id))];

  return {
    successCount: successful.length,
    errorCount: results.length - successful.length,
    uniqueWithdrawalIds: uniqueIds,
    idempotencyKey
  };
}

async function simulateBotAttack(users, iterations) {
  const operations = Array.from({ length: iterations }).map((_, index) => {
    const user = users[index % users.length];
    return flagUserRisk(user.id, {
      flagType: 'bot_attack',
      severity: index % 4 === 0 ? 'critical' : 'high',
      scoreDelta: 12 + (index % 3) * 6,
      details: {
        scenario: 'bot_attack',
        ip: `10.0.0.${(index % 12) + 10}`,
        userAgent: 'stress-bot/1.0'
      }
    });
  });

  const results = await Promise.allSettled(operations);
  return {
    successCount: results.filter((item) => item.status === 'fulfilled').length,
    errorCount: results.filter((item) => item.status === 'rejected').length,
    maxRiskScore: Math.max(
      0,
      ...results
        .filter((item) => item.status === 'fulfilled')
        .map((item) => item.value.riskScore)
    )
  };
}

export async function runStressSimulation({ scenario = 'concurrent_bets', iterations = 12, adminId = 'admin' }) {
  ensureTestMode();
  const users = await getSandboxUsers(6);
  if (users.length === 0) {
    throw Object.assign(new Error('No sandbox users available. Run the seed task first.'), { statusCode: 400 });
  }

  let summary;
  if (scenario === 'concurrent_bets') {
    summary = await simulateConcurrentBets(users, iterations);
  } else if (scenario === 'withdraw_race') {
    summary = await simulateWithdrawRace(users, iterations);
  } else if (scenario === 'bot_attack') {
    summary = await simulateBotAttack(users, iterations);
  } else {
    throw Object.assign(new Error('Unknown stress scenario'), { statusCode: 400 });
  }

  await writeAuditLog('admin', adminId, 'stress.simulation_run', null, {
    scenario,
    iterations,
    summary
  });

  return {
    scenario,
    iterations,
    summary
  };
}
