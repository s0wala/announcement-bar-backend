const express = require('express');
const router = express.Router();
const cors = require('cors');
const pool = require('../config/database');

// Allow this specific route to be accessed by any browser (CORS)
router.use(cors());

router.get('/bar', async (req, res) => {
    try {
        const { shop } = req.query;

        // Validation
        if (!shop) {
            return res.status(400).json({ error: 'Shop parameter required' });
        }

        // 1. Find the user ID associated with this shop
        const userQuery = await pool.query(
            'SELECT id FROM users WHERE shopify_shop = $1',
            [shop]
        );

        if (userQuery.rows.length === 0) {
            return res.json({ active: false, reason: 'Shop not found' });
        }

        const userId = userQuery.rows[0].id;

        // 2. Find the ACTIVE bar for this user
        const barQuery = await pool.query(
            `SELECT * FROM announcement_bars 
             WHERE user_id = $1 AND is_active = true 
             ORDER BY updated_at DESC LIMIT 1`,
            [userId]
        );

        if (barQuery.rows.length === 0) {
            return res.json({ active: false, reason: 'No active bars' });
        }

        const bar = barQuery.rows[0];

        // 3. Get messages for this bar
        const messagesQuery = await pool.query(
            'SELECT * FROM messages WHERE bar_id = $1 ORDER BY display_order ASC',
            [bar.id]
        );

        // 4. Return the configuration as JSON
        res.json({
            active: true,
            bar: bar,
            messages: messagesQuery.rows
        });

    } catch (err) {
        console.error('Public API Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
