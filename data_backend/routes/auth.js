import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  fullName: z.string().min(1, 'Full name is required').max(100).trim(),
  role: z.string().max(100).trim().optional().default(''),
  organization: z.string().max(100).trim().optional().default(''),
  platform: z.enum(['personal_analytics', 'business_intelligence', 'machine_learning', 'data_engineering']).optional().default('business_intelligence'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Helper to generate JWT
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid input';
      return res.status(400).json({ message: firstError });
    }

    const { email, password, fullName, role, organization, platform } = parsed.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      fullName,
      role,
      organization,
      platform,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Invalid input';
      return res.status(400).json({ message: firstError });
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: user.toJSON() });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;
