/**
 * Stripe Environment Variables Check Script
 * 
 * This script helps diagnose common issues with Stripe integration.
 * Run it with: node check-stripe-env.js
 */

require('dotenv').config();

console.log('======== STRIPE ENVIRONMENT CHECK ========');

// Check Stripe Secret Key
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY is missing');
} else if (!stripeKey.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY format is invalid - should start with "sk_"');
} else {
  const keyType = stripeKey.includes('_test_') ? 'TEST' : 'LIVE';
  console.log(`✅ STRIPE_SECRET_KEY is set (${keyType} mode)`);
}

// Check Webhook Secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.error('❌ STRIPE_WEBHOOK_SECRET is missing');
} else if (!webhookSecret.startsWith('whsec_')) {
  console.error('❌ STRIPE_WEBHOOK_SECRET format is invalid - should start with "whsec_"');
} else {
  console.log('✅ STRIPE_WEBHOOK_SECRET is set');
}

// Check URLs
const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
  console.error('❌ FRONTEND_URL is missing');
} else if (!frontendUrl.startsWith('http')) {
  console.error('❌ FRONTEND_URL should start with http:// or https://');
} else {
  console.log(`✅ FRONTEND_URL is set: ${frontendUrl}`);
}

const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  console.error('❌ BACKEND_URL is missing');
} else if (!backendUrl.startsWith('http')) {
  console.error('❌ BACKEND_URL should start with http:// or https://');
} else {
  console.log(`✅ BACKEND_URL is set: ${backendUrl}`);
}

console.log('\n======== RECOMMENDED ACTIONS ========');
if (!stripeKey || !stripeKey.startsWith('sk_')) {
  console.log('1. Add a valid STRIPE_SECRET_KEY to your .env file');
  console.log('   Format: STRIPE_SECRET_KEY=sk_test_...');
}

if (!webhookSecret || !webhookSecret.startsWith('whsec_')) {
  console.log('2. Add a valid STRIPE_WEBHOOK_SECRET to your .env file');
  console.log('   Format: STRIPE_WEBHOOK_SECRET=whsec_...');
}

if (!frontendUrl || !frontendUrl.startsWith('http')) {
  console.log('3. Add a valid FRONTEND_URL to your .env file');
  console.log('   Format: FRONTEND_URL=http://localhost:8080');
}

if (!backendUrl || !backendUrl.startsWith('http')) {
  console.log('4. Add a valid BACKEND_URL to your .env file');
  console.log('   Format: BACKEND_URL=http://localhost:3000');
}

console.log('\nFor more information, visit: https://stripe.com/docs/keys'); 