import { Router } from 'express';
import { z } from 'zod';
import Dataset from '../models/Dataset.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// All routes below need user to be logged in
router.use(authMiddleware);

// ─── Validation Schemas ───────────────────────────────────────────────────────
const saveDatasetSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  size: z.number().nonnegative().optional().default(0),
  ext: z.string().max(10).optional().default('csv'),
  rowCount: z.number().nonnegative().optional().default(0),
  headers: z.array(z.string()).optional().default([]),
  stats: z.any().optional().default(null),
  parseTime: z.number().nonnegative().optional().default(0),
  rows: z.any().optional().default([]),
});

// Save a new dataset (called when user uploads a file)
router.post('/', async (req, res) => {
  try {
    const parsed = saveDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid dataset data';
      return res.status(400).json({ message: firstError });
    }

    const { name, size, ext, rowCount, headers, stats, parseTime, rows } = parsed.data;
    console.log(`📥 Saving dataset: "${name}" (${rowCount} rows, ${headers?.length} cols)`);

    const dataset = await Dataset.create({
      userId: req.userId,
      name,
      size,
      ext,
      rowCount,
      headers,
      stats,
      parseTime,
      rows,
    });

    console.log(`✅ Dataset saved: ${dataset._id}`);
    res.status(201).json({ dataset });
  } catch (err) {
    console.error('❌ Save dataset error:', err.message || err);
    res.status(500).json({ message: 'Could not save dataset.', error: err.message });
  }
});

// Get all datasets for the logged-in user (with pagination)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [datasets, total] = await Promise.all([
      Dataset.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Dataset.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      datasets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch datasets.' });
  }
});

// Delete one dataset
router.delete('/:id', async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ _id: req.params.id, userId: req.userId });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });

    await dataset.deleteOne();
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete dataset.' });
  }
});

export default router;
