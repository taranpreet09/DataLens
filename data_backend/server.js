import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';
import datasetRoutes from './routes/datasets.js';
import analysisRoutes from './routes/analysis.js';
import analysisEngineRoutes from './routes/analysisEngine.js';
import advancedMlRoutes from './routes/advancedMl.js';
import collaborationRoutes from './routes/collaboration.js';
import intelligenceRoutes from './routes/intelligence.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Startup Guards ───────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set.');
  console.error('   Set JWT_SECRET in your .env file to a secure random string.');
  process.exit(1);
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: corsOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join user-specific room for targeted updates
  socket.join(`user:${socket.userId}`);
  console.log(`🔌 Socket connected: user ${socket.userId}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: user ${socket.userId}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/datasets', apiLimiter, datasetRoutes);
app.use('/api/analysis', apiLimiter, analysisRoutes);
app.use('/api/analysis-engine', apiLimiter, analysisEngineRoutes);
app.use('/api/advanced-ml', apiLimiter, advancedMlRoutes);
app.use('/api/collaboration', apiLimiter, collaborationRoutes);
app.use('/api/intelligence', apiLimiter, intelligenceRoutes);

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

    // Fix stale indexes (drop non-sparse shareToken unique index if it exists)
    try {
      const collection = mongoose.connection.collection('datasets');
      const indexes = await collection.indexes();
      const badIndex = indexes.find(idx =>
        idx.key?.shareToken && idx.unique && !idx.sparse
      );
      if (badIndex) {
        await collection.dropIndex(badIndex.name);
        console.log('🔧 Dropped non-sparse shareToken index, will be recreated as sparse');
      }
    } catch { /* index doesn't exist or already correct — fine */ }
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

  // Initialize job queue (requires Redis — graceful fallback if unavailable)
  try {
    const { initJobQueue } = await import('./services/jobQueue.js');
    initJobQueue(io);
  } catch (err) {
    console.warn('⚠️  Job queue not available (Redis may not be running):', err.message);
    console.log('   Dataset processing will fall back to synchronous mode.');
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Data Lens API running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready`);
  });
}

start();
