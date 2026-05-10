import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import datasetRoutes from './routes/datasets.js';
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 attempts per window
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/datasets', apiLimiter, datasetRoutes);
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
