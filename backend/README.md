# Announcement Bar Builder - Backend API

A complete SaaS backend for creating, managing, and serving announcement bars for websites.

## Features

- ✅ User authentication (JWT)
- ✅ CRUD operations for announcement bars and messages
- ✅ Widget JavaScript generation and serving
- ✅ Analytics tracking (impressions, clicks, closes)
- ✅ Multi-message rotation
- ✅ Countdown timers
- ✅ A/B testing support
- ✅ Geo-targeting
- ✅ Page targeting
- ✅ Device targeting (mobile/desktop)
- ✅ Custom CSS/JS injection
- ✅ Navigation links
- ✅ Multi-language support
- ✅ Stripe subscription integration (ready)

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT
- **Payments:** Stripe
- **Security:** Helmet, rate limiting

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### 2. Database Setup

```bash
# Create database
createdb announcement_bar

# Run schema
psql announcement_bar < schema.sql
```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Environment Configuration

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (generate with: `openssl rand -base64 32`)
- `STRIPE_SECRET_KEY` (from Stripe dashboard)
- `FRONTEND_URL` (your React app URL)

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Announcement Bars
- `GET /api/bars` - List all bars
- `POST /api/bars` - Create new bar
- `GET /api/bars/:id` - Get bar with messages
- `PUT /api/bars/:id` - Update bar
- `DELETE /api/bars/:id` - Delete bar

### Messages
- `POST /api/bars/:id/messages` - Add message to bar
- `PUT /api/bars/:barId/messages/:messageId` - Update message
- `DELETE /api/bars/:barId/messages/:messageId` - Delete message

### Widget
- `GET /widget/:barId.js` - Get widget JavaScript (public)

### Analytics
- `POST /api/analytics/track` - Track event (public, called by widget)
- `GET /api/analytics/bars/:barId` - Get bar analytics
- `GET /api/analytics/dashboard` - Get dashboard overview

## Widget Integration

To add an announcement bar to a website:

```html
<!-- Add to <head> or before </body> -->
<script src="https://your-api-domain.com/widget/BAR_ID_HERE.js" async></script>
```

Replace `BAR_ID_HERE` with the actual bar ID from the database.

## Pricing Tiers

### Free Plan
- 1 announcement bar
- Basic features
- 14-day trial

### Basic Plan ($19/month)
- 5 announcement bars
- All features
- Priority support

### Pro Plan ($49/month)
- 20 announcement bars
- All features
- White-label option
- Priority support

### Enterprise Plan ($199/month)
- 100 announcement bars
- All features
- White-label
- Dedicated support
- Custom integrations

## Database Schema

### Tables
- `users` - User accounts
- `announcement_bars` - Announcement bar configurations
- `messages` - Individual messages/variations
- `nav_links` - Navigation links for bars
- `analytics_events` - Tracking data (impressions, clicks, closes)

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- Helmet.js security headers
- Input validation with Joi
- SQL injection prevention
- CORS configuration

## Production Deployment

### Option 1: Heroku

```bash
# Install Heroku CLI
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=your_secret
heroku config:set STRIPE_SECRET_KEY=your_key
heroku config:set FRONTEND_URL=https://your-frontend.com

# Deploy
git push heroku main

# Run migrations
heroku run npm run db:migrate
```

### Option 2: Railway

1. Connect GitHub repo
2. Add PostgreSQL database
3. Set environment variables
4. Deploy automatically on push

### Option 3: DigitalOcean App Platform

1. Connect GitHub repo
2. Add managed PostgreSQL database
3. Configure environment variables
4. Auto-deploys on push

### Option 4: VPS (DigitalOcean, AWS, etc.)

```bash
# Install Node.js and PostgreSQL
# Clone repo
# Set up PM2 for process management
pm2 start server.js --name announcement-bar-api
pm2 save
pm2 startup

# Set up Nginx reverse proxy
# Add SSL with Let's Encrypt
```

## Monitoring

### Health Check
```bash
curl https://your-api-domain.com/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "env": "production"
}
```

## Testing

```bash
# Run tests (once implemented)
npm test

# Test database connection
npm run db:test

# Lint code
npm run lint
```

## Troubleshooting

### Common Issues

**Database connection error:**
- Check PostgreSQL is running
- Verify credentials in .env
- Ensure database exists

**JWT errors:**
- Verify JWT_SECRET is set
- Check token expiration
- Ensure Authorization header format: `Bearer <token>`

**Widget not loading:**
- Check bar is active
- Verify subscription status
- Check CORS settings

## Performance Optimization

- Enable Redis for session caching
- Use CDN for widget delivery
- Implement database connection pooling
- Add indexes for frequently queried fields
- Cache widget responses (5-minute default)

## Future Enhancements

- [ ] Stripe webhook integration
- [ ] Email notifications
- [ ] Webhook endpoints for integrations
- [ ] Advanced A/B testing with statistical significance
- [ ] Heatmap analytics
- [ ] Export analytics to CSV
- [ ] Team collaboration features
- [ ] API rate limiting per plan
- [ ] Custom domain support

## Support

For issues or questions:
- GitHub Issues
- Email: support@yourdomain.com
- Documentation: docs.yourdomain.com

## License

MIT License - see LICENSE file for details
