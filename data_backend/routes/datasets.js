import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Dataset from '../models/Dataset.js';
import authMiddleware from '../middleware/auth.js';
import { UPLOADS_DIR, PARSED_DIR } from '../config/storage.js';
import { addProcessingJob } from '../services/jobQueue.js';
import { readRowsPage, deleteParsedFile } from '../services/fileParser.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';

const router = Router();

// All routes below need user to be logged in
router.use(authMiddleware);

// ─── Multer config for file uploads ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.tsv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TSV, and Excel files are supported.'));
    }
  },
});

// ─── Validation Schemas ───────────────────────────────────────────────────────
const saveDatasetSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  size: z.number().nonnegative().optional().default(0),
  ext: z.string().max(10).optional().default('csv'),
  rowCount: z.number().nonnegative().optional().default(0),
  headers: z.array(z.string()).optional().default([]),
  stats: z.any().optional().default(null),
  parseTime: z.number().nonnegative().optional().default(0),
  rows: z.any().optional().default(null),
});

// ─── POST /upload — New file upload endpoint (stream-based) ──────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { originalname, size, path: filePath, filename } = req.file;
    const ext = path.extname(originalname).toLowerCase().replace('.', '');

    // Create dataset record in "processing" state
    const dataset = await Dataset.create({
      userId: req.userId,
      name: originalname,
      size,
      ext,
      status: 'processing',
      uploadPath: filePath,
    });

    console.log(`📤 File uploaded: "${originalname}" (${(size / 1024 / 1024).toFixed(2)} MB) → processing...`);

    let jobId = null;
    try {
      jobId = await addProcessingJob(dataset._id.toString(), req.userId, filePath);
      await Dataset.findByIdAndUpdate(dataset._id, { jobId });
    } catch (queueErr) {
      // If Redis/queue is unavailable, process synchronously (fallback)
      console.warn('⚠️  Job queue unavailable, processing synchronously:', queueErr.message);
      try {
        const { parseFile } = await import('../services/fileParser.js');
        const { computeAllStats } = await import('../services/statsEngine.js');

        const { headers, rowCount, parsedFilePath, sampleRows } = await parseFile(filePath, dataset._id.toString());
        const stats = computeAllStats(headers, sampleRows.length > 0 ? sampleRows : []);

        await Dataset.findByIdAndUpdate(dataset._id, {
          headers,
          rowCount,
          stats,
          parsedFilePath,
          status: 'ready',
          parseTime: Date.now() - dataset.createdAt.getTime(),
        });

        const updated = await Dataset.findById(dataset._id);
        return res.status(201).json({ dataset: updated, processed: true });
      } catch (syncErr) {
        console.error('❌ Synchronous fallback processing error:', syncErr.message);
        await Dataset.findByIdAndUpdate(dataset._id, {
          status: 'error',
          error: syncErr.message || 'Synchronous processing failed',
        }).catch(() => {});
        throw syncErr;
      }
    }

    res.status(202).json({
      dataset: {
        _id: dataset._id,
        name: dataset.name,
        size: dataset.size,
        ext: dataset.ext,
        status: 'processing',
      },
      jobId,
      message: 'File uploaded. Processing in background.',
    });
  } catch (err) {
    console.error('❌ Upload error:', err.message || err);
    res.status(500).json({ message: err.message || 'Could not upload file.' });
  }
});

// ─── POST / — Legacy save endpoint (JSON body, backward compatible) ──────────
router.post('/', async (req, res) => {
  try {
    const parsed = saveDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid dataset data';
      return res.status(400).json({ message: firstError });
    }

    const { name, size, ext, rowCount, headers, stats, parseTime, rows } = parsed.data;
    console.log(`📥 Saving dataset: "${name}" (${rowCount} rows, ${headers?.length} cols)`);

    // Write rows to JSONL file instead of storing in MongoDB
    let parsedFilePath = null;
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const fileId = uuidv4();
      parsedFilePath = path.join(PARSED_DIR, `${fileId}.jsonl`);
      const lines = rows.map(row => JSON.stringify(row));
      fs.writeFileSync(parsedFilePath, lines.join('\n'), 'utf8');
    }

    const dataset = await Dataset.create({
      userId: req.userId,
      name,
      size,
      ext,
      rowCount,
      headers,
      stats,
      parseTime,
      parsedFilePath,
      rows: null,
      status: 'ready',
    });

    console.log(`✅ Dataset saved: ${dataset._id}`);
    res.status(201).json({ dataset });
  } catch (err) {
    console.error('❌ Save dataset error:', err.message || err);
    res.status(500).json({ message: 'Could not save dataset.', error: err.message });
  }
});

// ─── GET / — List datasets (with pagination) ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Check cache first
    const cacheKey = `datasets:${req.userId}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [datasets, total] = await Promise.all([
      Dataset.find({ userId: req.userId })
        .select('-rows') // Don't send raw rows in list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Dataset.countDocuments({ userId: req.userId }),
    ]);

    const response = {
      datasets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    // Cache for 60 seconds
    await cacheSet(cacheKey, response, 60);

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch datasets.' });
  }
});

// ─── GET /:id — Get single dataset metadata + stats ──────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId }).select('-rows');
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });
    res.json({ dataset });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch dataset.' });
  }
});

// ─── GET /:id/rows — Paginated row access ────────────────────────────────────
router.get('/:id/rows', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));

    // If dataset has a parsed file on disk, read from there
    if (dataset.parsedFilePath && fs.existsSync(dataset.parsedFilePath)) {
      const result = await readRowsPage(dataset.parsedFilePath, page, limit);
      return res.json({
        rows: result.rows,
        pagination: {
          page,
          limit,
          total: dataset.rowCount,
          totalPages: Math.ceil(dataset.rowCount / limit),
        },
      });
    }

    // Fallback: rows stored in MongoDB (legacy)
    if (dataset.rows && Array.isArray(dataset.rows)) {
      const start = (page - 1) * limit;
      const rows = dataset.rows.slice(start, start + limit);
      return res.json({
        rows,
        pagination: {
          page,
          limit,
          total: dataset.rows.length,
          totalPages: Math.ceil(dataset.rows.length / limit),
        },
      });
    }

    res.json({ rows: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch rows.' });
  }
});

// ─── POST /:id/reprocess — Recompute stats on an existing dataset ────────────
router.post('/:id/reprocess', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    if (!dataset.parsedFilePath || !fs.existsSync(dataset.parsedFilePath)) {
      return res.status(400).json({ message: 'No parsed data file found. Please re-upload the dataset.' });
    }

    const { readAllRows, stratifiedSample } = await import('../services/fileParser.js');
    const { computeAllStats } = await import('../services/statsEngine.js');

    const LARGE_DATASET_THRESHOLD = 50000;
    const rowCount = dataset.rowCount || 0;

    let statsRows;
    if (rowCount > LARGE_DATASET_THRESHOLD) {
      statsRows = await stratifiedSample(dataset.parsedFilePath, 30000, rowCount);
    } else {
      statsRows = await readAllRows(dataset.parsedFilePath);
    }

    const stats = computeAllStats(dataset.headers, statsRows);

    // Scale absolute counts to full dataset size if sampled
    if (rowCount > LARGE_DATASET_THRESHOLD && stats.totalNulls != null) {
      const scaleFactor = rowCount / statsRows.length;
      stats.totalNulls = Math.round(stats.totalNulls * scaleFactor);
      stats.duplicateRowCount = Math.round((stats.duplicateRowCount ?? stats.dupeCount ?? 0) * scaleFactor);
      stats.dupeCount = stats.duplicateRowCount;
    }
    stats.rowCount = rowCount;

    await Dataset.findByIdAndUpdate(dataset._id, {
      stats,
      // Clear cached AI artifacts so they regenerate with fresh stats
      narrative: null,
      edaReport: null,
    });

    // Invalidate list cache
    await cacheDel(`datasets:${req.userId}:*`);

    res.json({ message: 'Stats recomputed successfully.', stats });
  } catch (err) {
    console.error('❌ Reprocess error:', err.message || err);
    res.status(500).json({ message: 'Could not reprocess dataset.', error: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    // Clean up files safely
    try {
      if (dataset.uploadPath && fs.existsSync(dataset.uploadPath)) {
        fs.unlinkSync(dataset.uploadPath);
      }
    } catch (fErr) {
      console.warn(`⚠️ Failed to delete upload file: ${dataset.uploadPath}`, fErr.message);
    }

    try {
      if (dataset.parsedFilePath && fs.existsSync(dataset.parsedFilePath)) {
        fs.unlinkSync(dataset.parsedFilePath);
      }
    } catch (fErr) {
      console.warn(`⚠️ Failed to delete parsed file: ${dataset.parsedFilePath}`, fErr.message);
    }

    try {
      deleteParsedFile(dataset._id.toString());
    } catch (fErr) {
      console.warn(`⚠️ Failed to delete parsed file via helper: ${dataset._id}`, fErr.message);
    }

    // Invalidate cache
    await cacheDel(`datasets:${req.userId}:*`);

    await dataset.deleteOne();
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete dataset.' });
  }
});

export default router;
