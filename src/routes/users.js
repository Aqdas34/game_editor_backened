const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const nodemailer = require('nodemailer');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Get all users (admin only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status (admin only)
router.put('/:id/status', [auth, admin], async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate status
    const validStatuses = ['pending', 'active', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    user.status = status;
    await user.save();

    // Try to send email notification, but don't fail if it doesn't work
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: user.email,
          subject: 'Account Status Update',
          html: `
            <h1>Account Status Update</h1>
            <p>Your account status has been updated to: ${status}</p>
            ${status === 'active' ? '<p>You can now log in to your account.</p>' : ''}
          `
        });
      }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
      // Don't throw the error, just log it
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Delete user (admin only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.remove();
    res.json({ message: 'User removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    console.log('Fetching profile for user ID:', req.user.userId);
    
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('purchasedGames', 'name thumbnail');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User profile fetched:', {
      id: user._id,
      name: user.name,
      purchasedGamesCount: user.purchasedGames ? user.purchasedGames.length : 0
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/current', auth, async (req, res) => {
  try {
    console.log('Fetching current user profile for ID:', req.user.userId);
    
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('purchasedGames', 'name thumbnail');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User profile fetched:', {
      id: user._id,
      name: user.name,
      purchasedGamesCount: user.purchasedGames ? user.purchasedGames.length : 0
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;