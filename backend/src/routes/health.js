import { Router } from 'express';
import { env } from '../config/env.js';
import { fairRoll } from '../utils/rng.js';

const router = Router();

function respond(_req, res) {
  res.json({
    status: 'ok',
    appMode: env.appMode,
    rngDemo: fairRoll(100),
    ts: new Date().toISOString()
  });
}

router.get('/', respond);
router.get('/z', respond);

export default router;
