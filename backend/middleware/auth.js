const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await db.query(
            'SELECT id, email, full_name, plan, subscription_status FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const result = await db.query(
                'SELECT id, email, full_name, plan, subscription_status FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        }
        next();
    } catch (error) {
        next();
    }
};

const requireActiveSubscription = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.plan === 'free') {
        return next();
    }

    if (req.user.subscription_status !== 'active') {
        return res.status(403).json({ 
            error: 'Active subscription required',
            subscription_status: req.user.subscription_status 
        });
    }

    next();
};

module.exports = {
    authMiddleware,
    optionalAuth,
    requireActiveSubscription
};
