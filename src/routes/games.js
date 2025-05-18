const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Game = require('../models/Game');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all games (public)
router.get('/', async (req, res) => {
  try {
    const games = await Game.find().select('-images');
    res.json(games);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get game by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new game (admin only)
router.post('/', [auth, admin, upload.array('images', 10)], async (req, res) => {
  try {
    const { name, author, type, ageGroup } = req.body;
    const thumbnail = req.files[0].filename;
    const images = req.files.map(file => file.filename);

    const game = new Game({
      name,
      author,
      type,
      ageGroup,
      thumbnail,
      images
    });

    await game.save();
    res.status(201).json(game);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update game (admin only)
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const { name, author, type, ageGroup } = req.body;
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    game.name = name || game.name;
    game.author = author || game.author;
    game.type = type || game.type;
    game.ageGroup = ageGroup || game.ageGroup;

    await game.save();
    res.json(game);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete game (admin only)
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    await game.remove();
    res.json({ message: 'Game removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 