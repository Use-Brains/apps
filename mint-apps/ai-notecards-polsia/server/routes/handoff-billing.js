import { Router } from 'express';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';

const router = Router();

const billingPlaceholder = {
  status: 'unavailable',
  message: 'Billing and subscription checkout coming soon',
};

router.post('/checkout', requireXHR, authenticate, requireActiveUser, async (_req, res) => {
  res.json(billingPlaceholder);
});

router.post('/cancel', requireXHR, authenticate, requireActiveUser, async (_req, res) => {
  res.json(billingPlaceholder);
});

router.post('/portal', requireXHR, authenticate, requireActiveUser, async (_req, res) => {
  res.json(billingPlaceholder);
});

router.post('/webhook', async (_req, res) => {
  res.json({
    ...billingPlaceholder,
    webhook: true,
  });
});

export default router;
