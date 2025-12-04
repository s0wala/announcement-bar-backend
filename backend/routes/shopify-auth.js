const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');

const router = express.Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES;
const SHOPIFY_REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI;

// Step 1: Initiate OAuth
router.get('/install', (req, res) => {
    const { shop } = req.query;
    
    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }
    
    const state = crypto.randomBytes(16).toString('hex');
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${SHOPIFY_REDIRECT_URI}&state=${state}`;
    
    res.cookie('state', state);
    res.redirect(installUrl);
});

// Step 2: OAuth callback
router.get('/callback', async (req, res) => {
    const { code, hmac, shop, state } = req.query;
    const stateCookie = req.cookies.state;
    
    if (state !== stateCookie) {
        return res.status(403).send('Request origin cannot be verified');
    }
    
    if (!shop || !hmac || !code) {
        return res.status(400).send('Required parameters missing');
    }
    
    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });
        
        const accessToken = tokenResponse.data.access_token;
        
        // Get shop info
        const shopResponse = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
            headers: { 'X-Shopify-Access-Token': accessToken }
        });
        
        const shopData = shopResponse.data.shop;
        
        // Create user
        const userEmail = shopData.email || `${shop.replace('.myshopify.com', '')}@shopify-temp.com`;
        const userResult = await db.query(
            `INSERT INTO users (email, full_name, company_name, website_url, plan, shopify_shop, shopify_access_token)
             VALUES ($1, $2, $3, $4, 'free', $5, $6)
             ON CONFLICT (shopify_shop) DO UPDATE
             SET shopify_access_token = $6, email = $1
             RETURNING id`,
            [userEmail, shopData.shop_owner, shopData.name, `https://${shop}`, shop, accessToken]
        );
        
        const userId = userResult.rows[0].id;
        
        // Create default announcement bar
        const barResult = await db.query(
            `INSERT INTO announcement_bars (user_id, name, is_active, rotation_enabled)
             VALUES ($1, $2, true, false)
             RETURNING id`,
            [userId, `${shopData.name} - Announcement Bar`]
        );
        
        const barId = barResult.rows[0].id;
        
        // Add default welcome message
        await db.query(
            `INSERT INTO messages (bar_id, text, bg_color, text_color, button_text, button_url, button_bg_color, button_text_color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [barId, '🎉 Welcome! Get 10% off your first order', '#4F46E5', '#ffffff', 'Shop Now', '/collections/all', '#ffffff', '#4F46E5']
        );
        
        // Install widget script tag
        try {
            await axios.post(
                `https://${shop}/admin/api/2024-01/script_tags.json`,
                {
                    script_tag: {
                        event: 'onload',
                        src: `https://announcement-bar-api.onrender.com/widget/${barId}.js`
                    }
                },
                { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
            );
        } catch (err) {
            console.error('Script error:', err.response?.data);
        }
            
        res.send(`
            <html>
            <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h1>🎉 Everything Bar Installed!</h1>
                <p>Your app is ready to use.</p>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).send('Installation failed');
    }
});

module.exports = router;
