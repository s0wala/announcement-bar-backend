const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/db');

// Price IDs from Stripe
const PRICES = {
    basic: 'price_1SsUTlGle52Uo94CbIl0iZec',
    pro: 'price_1SsUUGGle52Uo94Cg4AgthxU'
};

// Create checkout session for subscription
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { plan } = req.body;

        if (!PRICES[plan]) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Get or create Stripe customer
        let customerId = req.user.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                metadata: {
                    user_id: req.user.id
                }
            });
            customerId = customer.id;

            // Save customer ID to database
            await db.query(
                'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                [customerId, req.user.id]
            );
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: PRICES[plan],
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'https://announcement-bar-api.onrender.com'}/dashboard.html?success=true&plan=${plan}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://announcement-bar-api.onrender.com'}/dashboard.html?canceled=true`,
            metadata: {
                user_id: req.user.id,
                plan: plan
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Get current subscription status
router.get('/subscription', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT plan, subscription_status, stripe_subscription_id FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            plan: result.rows[0].plan,
            status: result.rows[0].subscription_status,
            hasSubscription: !!result.rows[0].stripe_subscription_id
        });
    } catch (error) {
        console.error('Subscription fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT stripe_subscription_id FROM users WHERE id = $1',
            [req.user.id]
        );

        const subscriptionId = result.rows[0]?.stripe_subscription_id;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        // Cancel at period end (they keep access until the end of billing period)
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });

        res.json({ message: 'Subscription will cancel at end of billing period' });
    } catch (error) {
        console.error('Cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

module.exports = router;
