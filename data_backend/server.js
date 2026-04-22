import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import datasetRoutes from './routes/datasets.js';
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Connect to MongoDB & Start Server ────────────────────────────────────────
async function start() {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB:', process.env.MONGO_URI);
  } catch (err) {
    console.error('⚠️  MongoDB not available:', err.message);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  MongoDB server is NOT running on your machine.');
    console.log('');
    console.log('  To fix this, do ONE of the following:');
    console.log('');
    console.log('  1. Install MongoDB Community Server:');
    console.log('     https://www.mongodb.com/try/download/community');
    console.log('     (Select Windows, MSI, install as a Service)');
    console.log('');
    console.log('  2. OR use MongoDB Atlas (free cloud DB):');
    console.log('     https://www.mongodb.com/atlas');
    console.log('     Then update MONGO_URI in .env with your Atlas URI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Obsidian Analytics API running on http://localhost:${PORT}`);
  });
}

start();
