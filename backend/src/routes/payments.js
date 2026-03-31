import express, { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { createCheckoutSession, handleStripeWebhook } from '../services/paymentService.js';

const router = Router();

router.post('/checkout', requireUser, async (req, res, next) => {
  try {
    const session = await createCheckoutSession(req.userId);
    res.status(201).json({ id: session.id, url: session.url });
  } catch (error) {
    next(error);
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.header('stripe-signature');
    const result = await handleStripeWebhook(signature, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

