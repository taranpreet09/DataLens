import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = Router();

// Helper to generate JWT
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, role, organization, platform } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'Email, password, and full name are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

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
      role: role || '',
      organization: organization || '',
      platform: platform || 'business_intelligence',
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

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

// ─── POST /api/auth/google ────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Since we use useGoogleLogin, we receive an access_token. We fetch the user profile directly.
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }

    const payload = await googleRes.json();
    const { email, name } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Email not found in Google profile' });
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        email: email.toLowerCase(),
        fullName: name || 'Google User',
        authProvider: 'google',
        // Optional fields set to default
        role: '',
        organization: '',
        platform: 'business_intelligence',
      });
    }

    const jwtToken = generateToken(user._id);

    res.json({
      token: jwtToken,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: 'Server error during Google authentication' });
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
