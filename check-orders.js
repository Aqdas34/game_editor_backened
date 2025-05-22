/**
 * Order Database Check Script
 * 
 * This script helps diagnose issues with orders in the database.
 * Run it with: node check-orders.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./src/models/Order');
const User = require('./src/models/User');
const Game = require('./src/models/Game');

async function main() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Count total orders
    const orderCount = await Order.countDocuments();
    console.log(`Total orders in database: ${orderCount}`);
    
    if (orderCount === 0) {
      console.log('⚠️ No orders found in the database');
    } else {
      // Get all orders with populated user and game data
      const orders = await Order.find()
        .populate('user', 'email name')
        .populate('game', 'name');
      
      console.log('\n===== Orders in Database =====');
      orders.forEach((order, index) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log(`  ID: ${order._id}`);
        console.log(`  User: ${order.user ? `${order.user.name} (${order.user.email})` : 'Unknown user'}`);
        console.log(`  Game: ${order.game ? order.game.name : 'Unknown game'}`);
        console.log(`  Amount: $${order.amount}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Payment ID: ${order.stripePaymentId}`);
        console.log(`  Created: ${order.createdAt}`);
      });
    }
    
    // Check users with purchased games
    const usersWithGames = await User.find({ purchasedGames: { $exists: true, $not: { $size: 0 } } })
      .select('email name purchasedGames');
    
    console.log(`\n===== Users with Purchased Games: ${usersWithGames.length} =====`);
    for (const user of usersWithGames) {
      console.log(`\nUser: ${user.name} (${user.email})`);
      console.log(`  Games purchased: ${user.purchasedGames.length}`);
      
      // Get game details
      for (let i = 0; i < user.purchasedGames.length; i++) {
        const gameId = user.purchasedGames[i];
        const game = await Game.findById(gameId).select('name');
        console.log(`  Game ${i+1}: ${game ? game.name : 'Unknown game'} (ID: ${gameId})`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

main(); 