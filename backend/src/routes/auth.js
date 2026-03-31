import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loginUser, registerUser } from '../services/authService.js';
import { pool } from '../db/pool.js';

const router = Router();

router.post('/register', rateLimit({ keyPrefix: 'auth-register', limit: 10, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    const result = await registerUser(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', rateLimit({ keyPrefix: 'auth-login', limit: 20, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    res.json(await loginUser(req.body || {}));
  } catch (error) {
    next(error);
  }
});

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
    res.json(result.rows[0] || null);
  } catch (error) {
    next(error);
  }
});

export default router;
