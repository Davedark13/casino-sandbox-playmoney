import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.username, u.mode, u.role, u.is_blocked, u.risk_score,
              w.balance_cents, w.locked_balance_cents
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
