const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Game = require('../models/Game');
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

// Create new order
router.post('/', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: game.price * 100, // Convert to cents
      currency: 'usd',
      metadata: {
        gameId: game._id.toString(),
        userId: req.user.userId
      }
    });

    // Create order
    const order = new Order({
      user: req.user.userId,
      game: gameId,
      amount: game.price,
      stripePaymentId: paymentIntent.id,
      status: 'pending'
    });

    await order.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order._id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Confirm order after successful payment
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update order status
    order.status = 'confirmed';
    await order.save();

    // Add game to user's purchased games
    const user = await User.findById(req.user.userId);
    user.purchasedGames.push(order.game);
    await user.save();

    // Send confirmation email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: 'Order Confirmation',
      html: `
        <h1>Thank you for your purchase!</h1>
        <p>Your order has been confirmed. You can now access the full game content.</p>
        <p>Order ID: ${order._id}</p>
        <p>Amount: $${order.amount}</p>
      `
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId })
      .populate('game', 'name thumbnail')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders (admin only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('game', 'name')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('game', 'name thumbnail');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is admin or order owner
    if (order.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 