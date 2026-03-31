import fs from 'fs';
import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { writeAuditLog } from '../services/auditService.js';

fs.mkdirSync(env.kycStoragePath, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const upload = multer({
  dest: env.kycStoragePath,
  limits: {
    fileSize: env.kycMaxFileSizeMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(Object.assign(new Error('Unsupported document type. Allowed: JPG, PNG, PDF'), { statusCode: 400 }));
      return;
    }
    cb(null, true);
  }
});
const router = Router();

router.post('/upload', requireUser, rateLimit({ keyPrefix: 'kyc', limit: 10, windowSeconds: 3600 }), upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Missing document upload'), { statusCode: 400 });
    }

    const result = await pool.query(
      `INSERT INTO kyc_documents (user_id, status, document_type, storage_path)
       VALUES ($1, 'pending', $2, $3)
       RETURNING *`,
      [req.userId, req.body.documentType || 'unknown', req.file.path]
    );
    await writeAuditLog('user', req.userId, 'kyc.uploaded', result.rows[0].id, { path: req.file.path });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/review', requireAdmin, async (req, res, next) => {
  try {
    const { status, reviewerNote } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      throw Object.assign(new Error('Invalid KYC status'), { statusCode: 400 });
    }
    const result = await pool.query(
      `UPDATE kyc_documents
       SET status = $2, reviewer_note = $3, reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, status, reviewerNote || null]
    );
    if (!result.rows[0]) {
      throw Object.assign(new Error('KYC document not found'), { statusCode: 404 });
    }
    await writeAuditLog('admin', req.adminId, 'kyc.reviewed', req.params.id, { status });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
