import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendAlert } from '../services/alertService.js';
import { evaluateUserRisk, listFraudSnapshots } from '../services/fraudService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getSecurityPosture } from '../services/securityService.js';
import { reviewWithdrawal } from '../services/withdrawalService.js';
import { runStressSimulation } from '../services/simulationService.js';

const router = Router();

router.use(requireAdmin);

function parseLimit(input, fallback = 50, max = 100) {
  const parsed = Number(input || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

async function fetchUsers(limit = 50) {
  const result = await pool.query(
    `WITH latest_kyc AS (
       SELECT DISTINCT ON (user_id)
         user_id,
         status,
         document_type,
         storage_path,
         created_at,
         reviewed_at
       FROM kyc_documents
       ORDER BY user_id, created_at DESC
     )
     SELECT
       u.id,
       u.email,
       u.username,
       u.mode,
       u.role,
       u.is_blocked,
       u.block_reason,
       u.risk_score,
       u.created_at,
       w.balance_cents,
       w.locked_balance_cents,
       lk.status AS kyc_status,
       lk.document_type AS kyc_document_type,
       lk.storage_path AS kyc_document
     FROM users u
     JOIN wallets w ON w.user_id = u.id
     LEFT JOIN latest_kyc lk ON lk.user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function fetchWithdrawals(limit = 50) {
  const result = await pool.query(
    `SELECT
       wd.*,
       u.username,
       u.risk_score,
       u.is_blocked
     FROM withdrawals wd
     JOIN users u ON u.id = wd.user_id
     ORDER BY wd.requested_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function fetchTransactions(limit = 50) {
  const result = await pool.query(
    `SELECT
       t.*,
       u.username
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function fetchLogs(limit = 50) {
  const result = await pool.query(
    `SELECT *
     FROM activity_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function fetchKyc(limit = 50) {
  const result = await pool.query(
    `SELECT
       kd.*,
       u.username
     FROM kyc_documents kd
     JOIN users u ON u.id = kd.user_id
     ORDER BY kd.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, withdrawals, transactions, fraud, logs, kyc, statsResult] = await Promise.all([
      fetchUsers(25),
      fetchWithdrawals(25),
      fetchTransactions(25),
      listFraudSnapshots(25),
      fetchLogs(50),
      fetchKyc(25),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM users) AS users_total,
           (SELECT COUNT(*) FROM withdrawals WHERE status IN ('requested', 'pending')) AS pending_withdrawals,
           (SELECT COUNT(*) FROM user_flags WHERE resolved = FALSE) AS open_flags,
           (SELECT COUNT(*) FROM kyc_documents WHERE status = 'pending') AS pending_kyc`
      )
    ]);

    res.json({
      stats: statsResult.rows[0],
      security: getSecurityPosture(),
      users,
      withdrawals,
      transactions,
      fraud,
      logs,
      kyc
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    res.json(await fetchUsers(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.get('/withdrawals', async (req, res, next) => {
  try {
    res.json(await fetchWithdrawals(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    res.json(await fetchTransactions(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.get('/fraud', async (req, res, next) => {
  try {
    res.json(await listFraudSnapshots(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    res.json(await fetchLogs(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.get('/security-posture', (_req, res) => {
  res.json(getSecurityPosture());
});

router.get('/kyc', async (req, res, next) => {
  try {
    res.json(await fetchKyc(parseLimit(req.query.limit, 50)));
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/block', async (req, res, next) => {
  try {
    if (typeof req.body.blocked !== 'boolean') {
      throw Object.assign(new Error('blocked must be boolean'), { statusCode: 400 });
    }
    const result = await pool.query(
      `UPDATE users
       SET is_blocked = $2, block_reason = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.body.blocked, req.body.reason || null]
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    await writeAuditLog('admin', req.adminId, req.body.blocked ? 'user.blocked' : 'user.unblocked', req.params.id, {
      reason: req.body.reason || null
    });
    if (req.body.blocked) {
      await sendAlert('Manual user block', `user=${req.params.id} reason=${req.body.reason || 'n/a'}`, 'high');
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/users/:id/recalculate-risk', async (req, res, next) => {
  try {
    res.json(await evaluateUserRisk(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/withdrawals/:id/review', async (req, res, next) => {
  try {
    if (!['approve', 'reject'].includes(req.body.action)) {
      throw Object.assign(new Error('Invalid review action'), { statusCode: 400 });
    }
    await reviewWithdrawal(req.params.id, req.body.action, req.body.adminNote || '', req.adminId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/withdraws/:id/approve', async (req, res, next) => {
  try {
    await reviewWithdrawal(req.params.id, 'approve', req.body.adminNote || 'Approved via admin endpoint', req.adminId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/withdraws/:id/reject', async (req, res, next) => {
  try {
    await reviewWithdrawal(req.params.id, 'reject', req.body.adminNote || 'Rejected via admin endpoint', req.adminId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/simulate/stress', async (req, res, next) => {
  try {
    const result = await runStressSimulation({
      scenario: req.body.scenario,
      iterations: Number(req.body.iterations || 12),
      adminId: req.adminId
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
