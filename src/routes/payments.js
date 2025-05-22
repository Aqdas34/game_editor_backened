// routes/payments.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User'); // Adjust path to your User model
const Game = require('../models/Game');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// Create a checkout session
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { gameId } = req.body;
    
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }
    
    // Get game details
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Get user details
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user already purchased this game
    if (user.purchasedGames.includes(gameId)) {
      return res.status(400).json({ error: 'You already own this game' });
    }
    
    // Create a pending order
    const order = new Order({
      user: req.user.userId,
      game: gameId,
      amount: game.price,  // Store the price in dollars, not cents
      status: 'pending',
      stripePaymentId: 'pending' // Will be updated after payment
    });
    
    await order.save();

    // Prepare image URL - ensure it's a full URL that Stripe can access
    const imageUrl = game.thumbnail.startsWith('http') 
      ? game.thumbnail 
      : `${process.env.BACKEND_URL}/${game.thumbnail.replace(/^\//, '')}`;

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: game.name,
              description: `Game by ${game.author}`,
              // Don't use image if it's not a valid URL
              ...(imageUrl.startsWith('http') ? { images: [imageUrl] } : {})
            },
            unit_amount: Math.round(game.price * 100), // Convert to cents and ensure it's an integer
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/games/${gameId}`,
      customer_email: user.email,
      metadata: {
        gameId: gameId,
        userId: req.user.userId,
        orderId: order._id.toString()
      }
    });
    
    // Update order with Stripe session ID
    order.stripePaymentId = session.id;
    await order.save();

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // Send a more detailed error message
    res.status(500).json({ 
      error: 'Failed to create checkout session', 
      details: error.message,
      stripeError: error.type === 'StripeError' ? error.raw : null
    });
  }
});

// Verify session
router.get('/verify-session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    
    // Return the game ID and order ID from metadata
    res.json({
      gameId: session.metadata.gameId,
      orderId: session.metadata.orderId
    });
    
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ error: 'Failed to verify payment session' });
  }
});

// Verify Stripe configuration
router.get('/test-stripe', async (req, res) => {
  try {
    // Try to perform a simple Stripe API call
    const testResult = await stripe.customers.list({ limit: 1 });
    
    // Check if Stripe API key is set
    const hasValidKey = process.env.STRIPE_SECRET_KEY && 
                        process.env.STRIPE_SECRET_KEY.startsWith('sk_');
    
    res.json({
      success: true,
      message: 'Stripe configuration is valid',
      hasValidKey: hasValidKey,
      testApiCall: !!testResult.data,
      stripeVersion: stripe.VERSION,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Stripe configuration test failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Stripe configuration is invalid',
      error: error.message,
      type: error.type,
      stripeApiKeyFormat: process.env.STRIPE_SECRET_KEY ? 
        (process.env.STRIPE_SECRET_KEY.startsWith('sk_') ? 'Valid format' : 'Invalid format') : 
        'Missing key'
    });
  }
});

module.exports = router;