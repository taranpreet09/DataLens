import { Router } from 'express';
import Dataset from '../models/Dataset.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// All routes below need user to be logged in
router.use(authMiddleware);

// Save a new dataset (called when user uploads a file)
router.post('/', async (req, res) => {
  try {
    const { name, size, ext, rowCount, headers, stats, parseTime, rows } = req.body;

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

    res.status(201).json({ dataset });
  } catch (err) {
    console.error('Save dataset error:', err);
    res.status(500).json({ message: 'Could not save dataset.' });
  }
});

// Get all datasets for the logged-in user
router.get('/', async (req, res) => {
  try {
    const datasets = await Dataset.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ datasets });
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