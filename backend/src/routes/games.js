import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { playDemoRound } from '../services/gameService.js';

const router = Router();

router.post(
  '/demo-round',
  requireUser,
  rateLimit({ keyPrefix: 'demo-round', limit: 40, windowSeconds: 3600 }),
  async (req, res, next) => {
    try {
      const round = await playDemoRound(
        req.userId,
        Number(req.body.amountCents),
        req.header('idempotency-key'),
        req.body.metadata || {}
      );
      res.status(201).json(round);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
