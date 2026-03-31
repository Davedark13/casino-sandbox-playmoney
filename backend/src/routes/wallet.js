import { Router } from 'express';
import { env } from '../config/env.js';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { writeAuditLog } from '../services/auditService.js';
import { creditWallet, getWallet } from '../services/walletService.js';

const router = Router();

router.get('/', requireUser, async (req, res, next) => {
  try {
    res.json(await getWallet(req.userId));
  } catch (error) {
    next(error);
  }
});

router.post('/demo-fund', requireUser, rateLimit({ keyPrefix: 'demo-fund', limit: 6, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    if (env.appMode !== 'test') {
      throw Object.assign(new Error('Demo funds are only available in APP_MODE=test'), { statusCode: 403 });
    }
    const amountCents = Number(req.body.amountCents || 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw Object.assign(new Error('amountCents must be positive'), { statusCode: 400 });
    }

    const reference = req.header('idempotency-key') || `demo-fund-${req.userId}-${Date.now()}`;
    const result = await creditWallet(req.userId, amountCents, reference, { source: 'demo-fund' });
    await writeAuditLog('user', req.userId, 'wallet.demo_funded', req.userId, { amountCents, reference });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
