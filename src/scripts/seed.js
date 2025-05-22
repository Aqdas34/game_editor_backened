require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Game = require('../models/Game');
const Order = require('../models/Order');

// Database connection
mongoose.connect('mongodb://admin:W2RLcnOdGHz1CNux@SG-amused-amount-9327-73686.servers.mongodirector.com:27017/admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB for seeding'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Sample game data
const games = [
  {
    name: "Math Wizard",
    author: "Educational Studios",
    type: "educational",
    ageGroup: "7-12",
    sku: "EDU-123456-001",
    thumbnail: "/uploads/math-wizard-thumb.jpg",
    images: ["/uploads/math-wizard-1.jpg", "/uploads/math-wizard-2.jpg"],
    price: 14.99
  },
  {
    name: "Space Adventure",
    author: "Cosmic Games",
    type: "action",
    ageGroup: "13-17",
    sku: "ACT-234567-002",
    thumbnail: "/uploads/space-adventure-thumb.jpg",
    images: ["/uploads/space-adventure-1.jpg", "/uploads/space-adventure-2.jpg"],
    price: 19.99
  },
  {
    name: "Puzzle Master",
    author: "Brain Teasers Inc",
    type: "puzzle",
    ageGroup: "18+",
    sku: "PUZ-345678-003",
    thumbnail: "/uploads/puzzle-master-thumb.jpg",
    images: ["/uploads/puzzle-master-1.jpg"],
    price: 9.99
  },
  {
    name: "Castle Defense",
    author: "Strategy Kings",
    type: "strategy",
    ageGroup: "13-17",
    sku: "STR-456789-004",
    thumbnail: "/uploads/castle-defense-thumb.jpg",
    images: ["/uploads/castle-defense-1.jpg", "/uploads/castle-defense-2.jpg"],
    price: 24.99
  },
  {
    name: "Color Fun",
    author: "Kids First",
    type: "educational",
    ageGroup: "3-6",
    sku: "EDU-567890-005",
    thumbnail: "/uploads/color-fun-thumb.jpg",
    images: ["/uploads/color-fun-1.jpg"],
    price: 7.99
  }
];

// Sample user data
const users = [
  {
    email: "admin@example.com",
    password: "admin123",
    name: "Admin User",
    role: "admin",
    status: "active"
  },
  {
    email: "user1@example.com",
    password: "password123",
    name: "Regular User",
    role: "user",
    status: "active"
  },
  {
    email: "user2@example.com",
    password: "password456",
    name: "Game Player",
    role: "user",
    status: "active"
  }
];

// Clear database and add sample data
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Game.deleteMany({});
    await Order.deleteMany({});
    
    console.log('Previous data cleared');
    
    // Add games
    const createdGames = await Game.insertMany(games);
    console.log(`${createdGames.length} games added`);
    
    // Add users (with proper password handling)
    const createdUsers = [];
    for (const user of users) {
      // Create user with plain text password - the pre-save hook will hash it
      const newUser = await User.create(user);
      createdUsers.push(newUser);
    }
    console.log(`${createdUsers.length} users added`);
    
    // Create some sample orders
    const orders = [
      {
        user: createdUsers[1]._id, // Regular user
        game: createdGames[0]._id, // Math Wizard
        amount: createdGames[0].price,
        status: 'confirmed',
        stripePaymentId: 'pi_' + Math.random().toString(36).substring(2, 15),
        invoiceUrl: 'https://example.com/invoice/123'
      },
      {
        user: createdUsers[2]._id, // Game Player
        game: createdGames[1]._id, // Space Adventure
        amount: createdGames[1].price,
        status: 'confirmed',
        stripePaymentId: 'pi_' + Math.random().toString(36).substring(2, 15),
        invoiceUrl: 'https://example.com/invoice/456'
      },
      {
        user: createdUsers[2]._id, // Game Player
        game: createdGames[3]._id, // Castle Defense
        amount: createdGames[3].price,
        status: 'pending',
        stripePaymentId: 'pi_' + Math.random().toString(36).substring(2, 15)
      }
    ];
    
    const createdOrders = await Order.insertMany(orders);
    console.log(`${createdOrders.length} orders added`);
    
    // Update users with purchased games
    await User.findByIdAndUpdate(createdUsers[1]._id, {
      $push: { purchasedGames: createdGames[0]._id }
    });
    
    await User.findByIdAndUpdate(createdUsers[2]._id, {
      $push: { purchasedGames: [createdGames[1]._id, createdGames[3]._id] }
    });
    
    console.log('User purchased games updated');
    console.log('Database seeding completed successfully!');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase(); 