const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Game = require('../models/Game');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate SKU-like prefix for the file
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.round(Math.random() * 1E9);
    const uniqueSuffix = `${timestamp}-${random}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
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
router.post('/', [auth, admin, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 }
])], async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    console.log('Received files:', req.files);
    
    const { name, author, type, ageGroup } = req.body;
    
    if (!req.files) {
      console.log('No files received');
      return res.status(400).json({ message: 'No files were uploaded' });
    }
    
    if (!req.files.thumbnail || req.files.thumbnail.length === 0) {
      console.log('No thumbnail received');
      return res.status(400).json({ message: 'Thumbnail image is required' });
    }
    
    if (!req.files.images || req.files.images.length === 0) {
      console.log('No game images received');
      return res.status(400).json({ message: 'At least one game image is required' });
    }

    // Generate SKU
    const prefix = type.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sku = `${prefix}-${timestamp}-${random}`;

    console.log('Generated SKU:', sku);

    // Rename files to include SKU
    const thumbnail = `${sku}-${req.files.thumbnail[0].filename}`;
    const images = req.files.images.map(file => `${sku}-${file.filename}`);

    // Rename the files on disk
    fs.renameSync(
      path.join(uploadsDir, req.files.thumbnail[0].filename),
      path.join(uploadsDir, thumbnail)
    );

    for (let i = 0; i < req.files.images.length; i++) {
      fs.renameSync(
        path.join(uploadsDir, req.files.images[i].filename),
        path.join(uploadsDir, images[i])
      );
    }

    console.log('Processed files:', { thumbnail, images });

    const game = new Game({
      name,
      author,
      type,
      ageGroup,
      thumbnail,
      images,
      sku
    });

    await game.save();
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update game (admin only)
router.put('/:id', [auth, admin], upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Update text fields
    game.name = req.body.name || game.name;
    game.author = req.body.author || game.author;
    game.type = req.body.type || game.type;
    game.ageGroup = req.body.ageGroup || game.ageGroup;

    // Update thumbnail if new one is uploaded
    if (req.files && req.files.thumbnail) {
      // Delete old thumbnail if exists
      if (game.thumbnail) {
        const oldThumbnailPath = path.join(__dirname, '../../uploads', game.thumbnail);
        try {
          await fs.unlink(oldThumbnailPath);
        } catch (err) {
          console.error('Error deleting old thumbnail:', err);
        }
      }
      game.thumbnail = req.files.thumbnail[0].filename;
    }

    // Update images if new ones are uploaded
    if (req.files && req.files.images) {
      // Delete old images if they exist
      if (game.images && game.images.length > 0) {
        for (const oldImage of game.images) {
          const oldImagePath = path.join(__dirname, '../../uploads', oldImage);
          try {
            await fs.unlink(oldImagePath);
          } catch (err) {
            console.error('Error deleting old image:', err);
          }
        }
      }
      game.images = req.files.images.map(file => file.filename);
    }

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

    // Delete associated files
    if (game.thumbnail) {
      const thumbnailPath = path.join(uploadsDir, game.thumbnail);
      try {
        await fs.promises.unlink(thumbnailPath);
      } catch (err) {
        console.error('Error deleting thumbnail:', err);
      }
    }

    if (game.images && game.images.length > 0) {
      for (const image of game.images) {
        const imagePath = path.join(uploadsDir, image);
        try {
          await fs.promises.unlink(imagePath);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }

    // Delete the game document
    await Game.deleteOne({ _id: req.params.id });
    res.json({ message: 'Game removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save edited image
router.post('/save-edited-image', [auth, upload.single('image')], async (req, res) => {
  try {
    const { gameId, pageIndex } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Delete the old image if it exists
    if (game.images[pageIndex]) {
      const oldImagePath = path.join(uploadsDir, game.images[pageIndex]);
      try {
        await fs.promises.unlink(oldImagePath);
      } catch (err) {
        console.error('Error deleting old image:', err);
      }
    }

    // Update the image in the game document
    game.images[pageIndex] = req.file.filename;
    await game.save();

    res.json(game);
  } catch (error) {
    console.error('Error saving edited image:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const ensureDirSync = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Duplicate game images for user
router.post('/:gameId/duplicate-for-user', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const game = await Game.findById(req.params.gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    const userDir = path.join(uploadsDir, 'users', userId, req.params.gameId);
    ensureDirSync(userDir);
    // Copy each image if not already present
    for (const img of game.images) {
      const src = path.join(uploadsDir, img);
      const dest = path.join(userDir, img);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
    res.json({ message: 'Images duplicated for user' });
  } catch (error) {
    console.error('Error duplicating images for user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's game images
router.get('/:gameId/user-images/:userId', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    const userDir = path.join(uploadsDir, 'users', req.params.userId, req.params.gameId);
    ensureDirSync(userDir);
    // Only return images that exist in the user folder
    const images = game.images.filter(img => fs.existsSync(path.join(userDir, img)));
    res.json({ name: game.name, ageGroup: game.ageGroup, sku: game.sku, images });
  } catch (error) {
    console.error('Error getting user images:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save edited image for user
router.post('/save-edited-image-for-user', [auth, upload.single('image')], async (req, res) => {
  try {
    const { userId, gameId, pageIndex } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    const userDir = path.join(uploadsDir, 'users', userId, gameId);
    ensureDirSync(userDir);
    const imgName = game.images[pageIndex];
    const dest = path.join(userDir, imgName);
    // Overwrite the user's image
    fs.copyFileSync(req.file.path, dest);
    // Remove the temp upload
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Image saved for user' });
  } catch (error) {
    console.error('Error saving edited image for user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user owns a specific game
router.get('/:id/check-ownership', auth, async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;
    
    console.log(`Checking if user ${userId} owns game ${gameId}`);
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if the game is in the user's purchased games
    const owned = user.purchasedGames.some(id => id.toString() === gameId);
    
    console.log(`Game ownership result: ${owned ? 'Owned' : 'Not owned'}`);
    
    res.json({ owned });
  } catch (error) {
    console.error('Error checking game ownership:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 