// routes/webhooks.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Order = require('../models/Order');
const bodyParser = require('body-parser');

// Stripe webhook handler
router.post('/stripe', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(
        req.body,  // raw buffer
        sig,
        'whsec_bd754d55e2840c10344e79b2ccb117a66a5abd2b78ec20e50b268720ace7201b'
      );
      console.log(`✅ Webhook received: ${event.type}`);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      try {
        await fulfillOrder(session);
        console.log('✅ Order fulfilled successfully');
      } catch (error) {
        console.error('❌ Error fulfilling order:', error);
      }
    }
  
    res.json({ received: true });
  });

// Function to fulfill the order after successful payment
async function fulfillOrder(session) {
  // Get order information from the session metadata
  const { gameId, userId, orderId } = session.metadata;
  
  if (!orderId) {
    console.error('❌ No order ID in session metadata');
    throw new Error('Order ID not found in session metadata');
  }
  
  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    console.error(`❌ Order not found with ID: ${orderId}`);
    throw new Error(`Order not found with ID: ${orderId}`);
  }
  
  // Update order status
  order.status = 'confirmed';
  order.stripePaymentId = session.id;
  
  // Add invoice URL if available
  if (session.invoice) {
    try {
      const invoice = await stripe.invoices.retrieve(session.invoice);
      order.invoiceUrl = invoice.hosted_invoice_url;
    } catch (error) {
      console.error('Error retrieving invoice:', error);
    }
  }
  
  await order.save();
  console.log(`✅ Order ${orderId} marked as confirmed`);
  
  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    console.error(`❌ User not found with ID: ${userId}`);
    throw new Error(`User not found with ID: ${userId}`);
  }
  
  // Add game to user's purchased games if not already there
  if (!user.purchasedGames.includes(gameId)) {
    user.purchasedGames.push(gameId);
    await user.save();
    console.log(`✅ Game ${gameId} added to user ${userId}'s purchased games`);
  }
}

module.exports = router; 