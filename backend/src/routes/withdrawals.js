import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { evaluateUserRisk } from '../services/fraudService.js';
import { requestWithdrawal } from '../services/withdrawalService.js';

const router = Router();

router.post('/', requireUser, rateLimit({ keyPrefix: 'withdraw', limit: 5, windowSeconds: 3600 }), async (req, res, next) => {
  try {
    await evaluateUserRisk(req.userId);
    const withdrawal = await requestWithdrawal(
      req.userId,
      Number(req.body.amountCents),
      req.header('idempotency-key'),
      req.body.destinationMetadata || {}
    );
    res.status(201).json(withdrawal);
  } catch (error) {
    next(error);
  }
});

export default router;

