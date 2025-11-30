const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/track - Track analytics event (public endpoint for widget)
router.post('/track', async (req, res) => {
    try {
        const {
            bar_id,
            message_id,
            event_type,
            variant,
            device_type,
            page_url,
            referrer,
            session_id
        } = req.body;

        // Validate required fields
        if (!bar_id || !event_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get IP address
        const ip_address = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress;

        // Get user agent
        const user_agent = req.headers['user-agent'];

        // Insert analytics event
        await db.query(
            `INSERT INTO analytics_events 
             (bar_id, message_id, event_type, variant, device_type, page_url, 
              referrer, user_agent, ip_address, session_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [bar_id, message_id, event_type, variant, device_type, page_url,
             referrer, user_agent, ip_address, session_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Analytics tracking error:', error);
        // Don't fail widget loading due to analytics error
        res.json({ success: false });
    }
});

// GET /api/analytics/bars/:barId - Get analytics for a bar
router.get('/bars/:barId', authMiddleware, async (req, res) => {
    try {
        const { barId } = req.params;
        const { start_date, end_date, period = '7d' } = req.query;

        // Verify ownership
        const barCheck = await db.query(
            'SELECT id FROM announcement_bars WHERE id = $1 AND user_id = $2',
            [barId, req.user.id]
        );

        if (barCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Bar not found' });
        }

        // Calculate date range
        let startDate, endDate;
        if (start_date && end_date) {
            startDate = new Date(start_date);
            endDate = new Date(end_date);
        } else {
            endDate = new Date();
            startDate = new Date();
            
            switch(period) {
                case '24h':
                    startDate.setHours(startDate.getHours() - 24);
                    break;
                case '7d':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(startDate.getDate() - 90);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 7);
            }
        }

        // Get summary stats
        const summaryResult = await db.query(
            `SELECT 
                COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
                COUNT(*) FILTER (WHERE event_type = 'close') as closes,
                ROUND(
                    (COUNT(*) FILTER (WHERE event_type = 'click')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE event_type = 'impression'), 0) * 100),
                    2
                ) as ctr,
                ROUND(
                    (COUNT(*) FILTER (WHERE event_type = 'close')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE event_type = 'impression'), 0) * 100),
                    2
                ) as close_rate
             FROM analytics_events
             WHERE bar_id = $1 
             AND created_at BETWEEN $2 AND $3`,
            [barId, startDate, endDate]
        );

        // Get stats by message
        const messageStatsResult = await db.query(
            `SELECT 
                m.id,
                m.text,
                COUNT(*) FILTER (WHERE e.event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE e.event_type = 'click') as clicks,
                COUNT(*) FILTER (WHERE e.event_type = 'close') as closes,
                ROUND(
                    (COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'impression'), 0) * 100),
                    2
                ) as ctr
             FROM messages m
             LEFT JOIN analytics_events e ON m.id = e.message_id
                AND e.created_at BETWEEN $2 AND $3
             WHERE m.bar_id = $1
             GROUP BY m.id, m.text
             ORDER BY impressions DESC`,
            [barId, startDate, endDate]
        );

        // Get device breakdown
        const deviceStatsResult = await db.query(
            `SELECT 
                device_type,
                COUNT(*) as count,
                ROUND((COUNT(*)::numeric / SUM(COUNT(*)) OVER ()) * 100, 1) as percentage
             FROM analytics_events
             WHERE bar_id = $1 
             AND event_type = 'impression'
             AND created_at BETWEEN $2 AND $3
             GROUP BY device_type`,
            [barId, startDate, endDate]
        );

        // Get top pages
        const topPagesResult = await db.query(
            `SELECT 
                page_url,
                COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
                ROUND(
                    (COUNT(*) FILTER (WHERE event_type = 'click')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE event_type = 'impression'), 0) * 100),
                    2
                ) as ctr
             FROM analytics_events
             WHERE bar_id = $1 
             AND created_at BETWEEN $2 AND $3
             GROUP BY page_url
             ORDER BY impressions DESC
             LIMIT 10`,
            [barId, startDate, endDate]
        );

        // Get time series data (daily)
        const timeSeriesResult = await db.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
                COUNT(*) FILTER (WHERE event_type = 'close') as closes
             FROM analytics_events
             WHERE bar_id = $1 
             AND created_at BETWEEN $2 AND $3
             GROUP BY DATE(created_at)
             ORDER BY date ASC`,
            [barId, startDate, endDate]
        );

        res.json({
            summary: summaryResult.rows[0],
            by_message: messageStatsResult.rows,
            by_device: deviceStatsResult.rows,
            top_pages: topPagesResult.rows,
            time_series: timeSeriesResult.rows,
            date_range: {
                start: startDate,
                end: endDate
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// GET /api/analytics/dashboard - Get overall dashboard stats
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        
        switch(period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        // Get summary across all user's bars
        const summaryResult = await db.query(
            `SELECT 
                COUNT(DISTINCT e.bar_id) as active_bars,
                COUNT(*) FILTER (WHERE e.event_type = 'impression') as total_impressions,
                COUNT(*) FILTER (WHERE e.event_type = 'click') as total_clicks,
                ROUND(
                    (COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'impression'), 0) * 100),
                    2
                ) as avg_ctr
             FROM analytics_events e
             JOIN announcement_bars b ON e.bar_id = b.id
             WHERE b.user_id = $1 
             AND e.created_at BETWEEN $2 AND $3`,
            [req.user.id, startDate, endDate]
        );

        // Get top performing bars
        const topBarsResult = await db.query(
            `SELECT 
                b.id,
                b.name,
                COUNT(*) FILTER (WHERE e.event_type = 'impression') as impressions,
                COUNT(*) FILTER (WHERE e.event_type = 'click') as clicks,
                ROUND(
                    (COUNT(*) FILTER (WHERE e.event_type = 'click')::numeric / 
                     NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'impression'), 0) * 100),
                    2
                ) as ctr
             FROM announcement_bars b
             LEFT JOIN analytics_events e ON b.id = e.bar_id
                AND e.created_at BETWEEN $2 AND $3
             WHERE b.user_id = $1
             GROUP BY b.id, b.name
             ORDER BY impressions DESC
             LIMIT 5`,
            [req.user.id, startDate, endDate]
        );

        res.json({
            summary: summaryResult.rows[0],
            top_bars: topBarsResult.rows,
            date_range: {
                start: startDate,
                end: endDate
            }
        });
    } catch (error) {
        console.error('Get dashboard analytics error:', error);
        res.status(500).json({ error: 'Failed to get dashboard analytics' });
    }
});

module.exports = router;
