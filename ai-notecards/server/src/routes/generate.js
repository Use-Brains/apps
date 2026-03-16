import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { checkTrialExpiry, checkGenerationLimits } from '../middleware/plan.js';
import { generateCards, generateCardsWithVision } from '../services/ai.js';
import pool from '../db/pool.js';

const router = Router();

function summarizeVisionFiles(files = []) {
  return files.map((file, index) => ({
    index,
    mime: file.detectedMime || file.mimetype,
    sizeBytes: file.size,
  }));
}

function logVisionFailure(req, err) {
  console.error('Vision generation error:', {
    userId: req.userId,
    errorCode: err.code || 'UNKNOWN',
    message: err.message,
    generationCount: req.generationCount,
    generationLimit: req.generationLimit,
    activeVisionRequests,
    hasInputText: !!req.body?.input?.trim(),
    inputLength: req.body?.input?.length || 0,
    titleLength: req.body?.title?.length || 0,
    fileCount: req.files?.length || 0,
    files: summarizeVisionFiles(req.files),
    visionMeta: err.visionMeta || null,
  });
}

// Rate limiter — JSON message so client's request() can parse it
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retry_after: retryAfter,
    });
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fieldSize: 250 * 1024, parts: 15 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Accepted: JPEG, PNG, WebP.'));
    }
    cb(null, true);
  },
});

// Conditional multer — only apply on multipart requests so JSON text-only flow is unaffected
function optionalMulter(req, res, next) {
  if (req.is('multipart/form-data')) {
    return upload.array('photos', 5)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large. Maximum 5MB per photo.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 5 photos.' });
        }
        if (err.code === 'LIMIT_FIELD_VALUE') {
          return res.status(400).json({ error: 'Text input too large.' });
        }
        return res.status(400).json({ error: 'Upload error.' });
      }
      if (err) {
        return res.status(422).json({ error: err.message });
      }
      next();
    });
  }
  next();
}

// Magic byte validation — runs after multer
async function validateImageContent(req, res, next) {
  if (!req.files?.length) return next();
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  for (const file of req.files) {
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !allowedMimes.includes(type.mime)) {
      return res.status(422).json({ error: 'File content does not match an allowed image format.' });
    }
    file.detectedMime = type.mime;
  }
  next();
}

// Concurrency semaphore — prevent OOM and Gemini rate exhaustion
let activeVisionRequests = 0;
const MAX_CONCURRENT_VISION = parseInt(process.env.MAX_CONCURRENT_VISION, 10) || 3;

// POST /preview — AI generation only, returns unsaved cards. Consumes generation count.
router.post(
  '/preview',
  generateLimiter,
  requireXHR,
  authenticate,
  checkTrialExpiry,
  checkGenerationLimits,
  optionalMulter,
  validateImageContent,
  async (req, res) => {
    const { input, title } = req.body;

    // Input validation (applies to both JSON and multipart)
    if (input && input.length > 50000) {
      return res.status(400).json({ error: 'Input text is too long. Maximum 50,000 characters.' });
    }
    if (title && title.length > 200) {
      return res.status(400).json({ error: 'Title is too long. Maximum 200 characters.' });
    }
    if (!input?.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Input text or photos are required.' });
    }

    try {
      let cards;

      if (req.files?.length) {
        // Vision path
        if (activeVisionRequests >= MAX_CONCURRENT_VISION) {
          return res.status(503).json({ error: 'Photo processing is busy. Please try again in a moment.' });
        }
        activeVisionRequests++;
        try {
          cards = await generateCardsWithVision(input, req.files);
        } catch (err) {
          logVisionFailure(req, err);
          if (err.code === 'NO_CARDS') {
            return res.status(422).json({ error: err.message });
          }
          return res.status(502).json({
            error: 'Photo processing failed. Try clearer photos, or remove them to generate from text.',
          });
        } finally {
          activeVisionRequests--;
        }
      } else {
        // Text-only path
        cards = await generateCards(input);
      }

      // Increment generation count (consumed at preview time)
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        'UPDATE users SET daily_generation_count = $1, last_generation_date = $2 WHERE id = $3',
        [req.generationCount + 1, today, req.userId]
      );

      res.json({
        cards,
        generationsRemaining: req.generationLimit - (req.generationCount + 1),
      });
    } catch (err) {
      console.error('Generation error:', err);
      if (err.message === 'Failed to parse AI-generated cards') {
        return res.status(502).json({ error: 'AI returned an invalid response. Please try again.' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
