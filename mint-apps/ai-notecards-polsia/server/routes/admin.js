import { Router } from 'express';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';

const router = Router();

const adminPlaceholder = {
  status: 'unavailable',
  message: 'Admin moderation tools coming soon',
  shell: true,
};

router.get('/flags', authenticate, requireActiveUser, async (_req, res) => {
  res.json(adminPlaceholder);
});

router.patch('/flags/:id', requireXHR, authenticate, requireActiveUser, async (_req, res) => {
  res.json(adminPlaceholder);
});

router.patch('/users/:id/suspend', requireXHR, authenticate, requireActiveUser, async (_req, res) => {
  res.json(adminPlaceholder);
});

export default router;
