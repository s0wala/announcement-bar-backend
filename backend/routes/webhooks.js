const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/db');

// Stripe webhook handler
router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // If webhook secret is set, verify signature
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } else {
            // For testing without webhook secret
            event = JSON.parse(req.body);
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const userId = session.metadata?.user_id;
            const plan = session.metadata?.plan;
            const subscriptionId = session.subscription;

            if (userId && plan) {
                await db.query(
                    `UPDATE users
                     SET plan = $1,
                         subscription_status = 'active',
                         stripe_subscription_id = $2
                     WHERE id = $3`,
                    [plan, subscriptionId, userId]
                );
                console.log(`✅ User ${userId} upgraded to ${plan} plan`);
            }
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const customerId = subscription.customer;

            // Find user by stripe customer ID
            const result = await db.query(
                'SELECT id FROM users WHERE stripe_customer_id = $1',
                [customerId]
            );

            if (result.rows[0]) {
                const status = subscription.cancel_at_period_end ? 'canceling' : subscription.status;
                await db.query(
                    'UPDATE users SET subscription_status = $1 WHERE id = $2',
                    [status, result.rows[0].id]
                );
            }
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const customerId = subscription.customer;

            // Find user and downgrade to free
            const result = await db.query(
                'SELECT id FROM users WHERE stripe_customer_id = $1',
                [customerId]
            );

            if (result.rows[0]) {
                await db.query(
                    `UPDATE users
                     SET plan = 'free',
                         subscription_status = 'inactive',
                         stripe_subscription_id = NULL
                     WHERE id = $1`,
                    [result.rows[0].id]
                );
                console.log(`⬇️ User ${result.rows[0].id} downgraded to free plan`);
            }
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            const customerId = invoice.customer;

            const result = await db.query(
                'SELECT id FROM users WHERE stripe_customer_id = $1',
                [customerId]
            );

            if (result.rows[0]) {
                await db.query(
                    'UPDATE users SET subscription_status = $1 WHERE id = $2',
                    ['past_due', result.rows[0].id]
                );
            }
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

module.exports = router;
