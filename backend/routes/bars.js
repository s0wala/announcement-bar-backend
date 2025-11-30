const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authMiddleware, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();

// Validation schema for creating/updating bars
const barSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    is_active: Joi.boolean().optional(),
    rotation_enabled: Joi.boolean().optional(),
    rotation_interval: Joi.number().min(3).max(60).optional()
});

const messageSchema = Joi.object({
    text: Joi.string().required(),
    bg_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    text_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    font_family: Joi.string().optional(),
    font_size: Joi.number().min(10).max(32).optional(),
    letter_spacing: Joi.number().min(-2).max(10).optional(),
    text_align: Joi.string().valid('left', 'center', 'right').optional(),
    padding_vertical: Joi.number().min(5).max(40).optional(),
    flash_enabled: Joi.boolean().optional(),
    marquee_enabled: Joi.boolean().optional(),
    button_text: Joi.string().allow('').optional(),
    button_url: Joi.string().uri().allow('').optional(),
    button_bg_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    button_text_color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    bar_position: Joi.string().valid('top', 'bottom').optional(),
    sticky_enabled: Joi.boolean().optional(),
    close_button_enabled: Joi.boolean().optional(),
    mobile_only: Joi.boolean().optional(),
    desktop_only: Joi.boolean().optional(),
    countdown_enabled: Joi.boolean().optional(),
    countdown_date: Joi.date().iso().allow(null).optional(),
    countdown_text: Joi.string().optional(),
    page_targeting_enabled: Joi.boolean().optional(),
    page_targeting_type: Joi.string().optional(),
    target_url: Joi.string().optional(),
    ab_testing_enabled: Joi.boolean().optional(),
    ab_variant_text: Joi.string().allow('').optional(),
    ab_variant_button: Joi.string().allow('').optional(),
    ab_traffic_split: Joi.string().optional(),
    geo_targeting_enabled: Joi.boolean().optional(),
    target_countries: Joi.array().items(Joi.string()).optional(),
    background_image_enabled: Joi.boolean().optional(),
    background_image_url: Joi.string().uri().allow('').optional(),
    background_opacity: Joi.number().min(0).max(100).optional(),
    background_position: Joi.string().optional(),
    translations_enabled: Joi.boolean().optional(),
    translations: Joi.object().optional(),
    custom_css: Joi.string().allow('').optional(),
    custom_js: Joi.string().allow('').optional(),
    start_date: Joi.date().iso().allow(null).optional(),
    end_date: Joi.date().iso().allow(null).optional(),
    display_order: Joi.number().optional()
});

// GET /api/bars - Get all bars for current user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM announcement_bars 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({ bars: result.rows });
    } catch (error) {
        console.error('Get bars error:', error);
        res.status(500).json({ error: 'Failed to get announcement bars' });
    }
});

// GET /api/bars/:id - Get single bar with messages
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Get bar
        const barResult = await db.query(
            'SELECT * FROM announcement_bars WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (barResult.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement bar not found' });
        }

        const bar = barResult.rows[0];

        // Get messages
        const messagesResult = await db.query(
            'SELECT * FROM messages WHERE bar_id = $1 ORDER BY display_order ASC',
            [id]
        );

        // Get nav links
        const navLinksResult = await db.query(
            'SELECT * FROM nav_links WHERE bar_id = $1 ORDER BY display_order ASC',
            [id]
        );

        res.json({
            bar: {
                ...bar,
                messages: messagesResult.rows,
                nav_links: navLinksResult.rows
            }
        });
    } catch (error) {
        console.error('Get bar error:', error);
        res.status(500).json({ error: 'Failed to get announcement bar' });
    }
});

// POST /api/bars - Create new bar
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Validate input
        const { error, value } = barSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { name, is_active, rotation_enabled, rotation_interval } = value;

        // Check limits based on plan
        const countResult = await db.query(
            'SELECT COUNT(*) FROM announcement_bars WHERE user_id = $1',
            [req.user.id]
        );
        
        const barCount = parseInt(countResult.rows[0].count);
        const limits = {
            free: 1,
            basic: 5,
            pro: 20,
            enterprise: 100
        };

        if (barCount >= limits[req.user.plan]) {
            return res.status(403).json({ 
                error: `${req.user.plan} plan allows maximum ${limits[req.user.plan]} announcement bar(s)`,
                upgrade_required: true
            });
        }

        // Create bar
        const result = await db.query(
            `INSERT INTO announcement_bars (user_id, name, is_active, rotation_enabled, rotation_interval)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [req.user.id, name, is_active || true, rotation_enabled || false, rotation_interval || 5]
        );

        res.status(201).json({
            message: 'Announcement bar created successfully',
            bar: result.rows[0]
        });
    } catch (error) {
        console.error('Create bar error:', error);
        res.status(500).json({ error: 'Failed to create announcement bar' });
    }
});

// PUT /api/bars/:id - Update bar
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = barSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Verify ownership
        const checkResult = await db.query(
            'SELECT id FROM announcement_bars WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement bar not found' });
        }

        const { name, is_active, rotation_enabled, rotation_interval } = value;

        const result = await db.query(
            `UPDATE announcement_bars 
             SET name = COALESCE($1, name),
                 is_active = COALESCE($2, is_active),
                 rotation_enabled = COALESCE($3, rotation_enabled),
                 rotation_interval = COALESCE($4, rotation_interval)
             WHERE id = $5
             RETURNING *`,
            [name, is_active, rotation_enabled, rotation_interval, id]
        );

        res.json({
            message: 'Announcement bar updated successfully',
            bar: result.rows[0]
        });
    } catch (error) {
        console.error('Update bar error:', error);
        res.status(500).json({ error: 'Failed to update announcement bar' });
    }
});

// DELETE /api/bars/:id - Delete bar
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const checkResult = await db.query(
            'SELECT id FROM announcement_bars WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement bar not found' });
        }

        await db.query('DELETE FROM announcement_bars WHERE id = $1', [id]);

        res.json({ message: 'Announcement bar deleted successfully' });
    } catch (error) {
        console.error('Delete bar error:', error);
        res.status(500).json({ error: 'Failed to delete announcement bar' });
    }
});

// POST /api/bars/:id/messages - Add message to bar
router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const checkResult = await db.query(
            'SELECT id FROM announcement_bars WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement bar not found' });
        }

        // Validate message
        const { error, value } = messageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Insert message
        const columns = ['bar_id', ...Object.keys(value)];
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        const values = [id, ...Object.values(value)];

        const result = await db.query(
            `INSERT INTO messages (${columns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`,
            values
        );

        res.status(201).json({
            message: 'Message added successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ error: 'Failed to add message' });
    }
});

// PUT /api/bars/:barId/messages/:messageId - Update message
router.put('/:barId/messages/:messageId', authMiddleware, async (req, res) => {
    try {
        const { barId, messageId } = req.params;

        // Verify ownership
        const checkResult = await db.query(
            `SELECT m.id FROM messages m
             JOIN announcement_bars b ON m.bar_id = b.id
             WHERE m.id = $1 AND m.bar_id = $2 AND b.user_id = $3`,
            [messageId, barId, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Validate message
        const { error, value } = messageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Build update query
        const updates = Object.keys(value).map((key, i) => `${key} = $${i + 1}`);
        const values = [...Object.values(value), messageId];

        const result = await db.query(
            `UPDATE messages SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );

        res.json({
            message: 'Message updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update message error:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

// DELETE /api/bars/:barId/messages/:messageId - Delete message
router.delete('/:barId/messages/:messageId', authMiddleware, async (req, res) => {
    try {
        const { barId, messageId } = req.params;

        // Verify ownership
        const checkResult = await db.query(
            `SELECT m.id FROM messages m
             JOIN announcement_bars b ON m.bar_id = b.id
             WHERE m.id = $1 AND m.bar_id = $2 AND b.user_id = $3`,
            [messageId, barId, req.user.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        await db.query('DELETE FROM messages WHERE id = $1', [messageId]);

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

module.exports = router;
