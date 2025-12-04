const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const publicApiRoutes = require('./routes/public-api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
            imgSrc: ["'self'", "data:", "https:", "https://cdn.shopify.com"],
            connectSrc: ["'self'", "https:", "wss:"],
            frameAncestors: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"], // <--- THIS ALLOWS SHOPIFY
        },
    },
    crossOriginEmbedderPolicy: false, // Required for Shopify
    frameguard: false // Disable the default frame blocker
}));
app.use(cors({
    origin: '*',
    credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static('public'));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Widget endpoint rate limit
const widgetLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    message: 'Too many widget requests'
});
app.use('/widget/', widgetLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bars', require('./routes/bars'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/auth/shopify', require('./routes/shopify-auth'));
app.use('/widget', require('./routes/widget'));
app.use('/api/public', require('./routes/public-api'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log('==========================================');
    console.log('🚀 Announcement Bar API Server Running');
    console.log('==========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Frontend URL: http://localhost:3000`);
    console.log('==========================================');
});
