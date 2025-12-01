const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: '*',
    credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Widget endpoint has its own rate limit (more generous)
const widgetLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
    message: 'Too many widget requests'
});
app.use('/widget/', widgetLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bars', require('./routes/bars'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/widget', require('./routes/widget'));

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
    console.log(`
    ==========================================
    🚀 Announcement Bar API Server Running
    ==========================================
    Port: ${PORT}
    Environment: ${process.env.NODE_ENV || 'development'}
    Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
    ==========================================
    `);
});

module.exports = app;
