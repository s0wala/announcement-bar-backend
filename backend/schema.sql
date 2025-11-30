-- Database Schema for Announcement Bar Builder

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    website_url VARCHAR(500),
    plan VARCHAR(50) DEFAULT 'free', -- free, basic, pro, enterprise
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'inactive', -- active, inactive, past_due, canceled
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcement bars table
CREATE TABLE IF NOT EXISTS announcement_bars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Internal name for organization
    is_active BOOLEAN DEFAULT true,
    rotation_enabled BOOLEAN DEFAULT false,
    rotation_interval INTEGER DEFAULT 5, -- seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (each bar can have multiple messages)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES announcement_bars(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    bg_color VARCHAR(20) DEFAULT '#5469d4',
    text_color VARCHAR(20) DEFAULT '#ffffff',
    font_family VARCHAR(100) DEFAULT 'system',
    font_size INTEGER DEFAULT 14,
    letter_spacing DECIMAL(4,2) DEFAULT 0,
    text_align VARCHAR(20) DEFAULT 'center',
    padding_vertical INTEGER DEFAULT 12,
    
    -- Effects
    flash_enabled BOOLEAN DEFAULT false,
    marquee_enabled BOOLEAN DEFAULT false,
    
    -- Button
    button_text VARCHAR(100),
    button_url TEXT,
    button_bg_color VARCHAR(20) DEFAULT '#ffffff',
    button_text_color VARCHAR(20) DEFAULT '#5469d4',
    
    -- Advanced settings
    bar_position VARCHAR(20) DEFAULT 'top',
    sticky_enabled BOOLEAN DEFAULT true,
    close_button_enabled BOOLEAN DEFAULT false,
    mobile_only BOOLEAN DEFAULT false,
    desktop_only BOOLEAN DEFAULT false,
    
    -- Countdown timer
    countdown_enabled BOOLEAN DEFAULT false,
    countdown_date TIMESTAMP,
    countdown_text VARCHAR(100),
    
    -- Page targeting
    page_targeting_enabled BOOLEAN DEFAULT false,
    page_targeting_type VARCHAR(50), -- all, homepage, collection, product, cart, checkout, custom
    target_url VARCHAR(500),
    
    -- A/B Testing
    ab_testing_enabled BOOLEAN DEFAULT false,
    ab_variant_text TEXT,
    ab_variant_button VARCHAR(100),
    ab_traffic_split VARCHAR(20) DEFAULT '50-50',
    
    -- Geo-targeting
    geo_targeting_enabled BOOLEAN DEFAULT false,
    target_countries TEXT[], -- Array of country codes
    
    -- Background image
    background_image_enabled BOOLEAN DEFAULT false,
    background_image_url TEXT,
    background_opacity INTEGER DEFAULT 30,
    background_position VARCHAR(20) DEFAULT 'center',
    
    -- Translations
    translations_enabled BOOLEAN DEFAULT false,
    translations JSONB, -- {language: text} pairs
    
    -- Custom code
    custom_css TEXT,
    custom_js TEXT,
    
    -- Scheduling
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    
    -- Metadata
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Navigation links table
CREATE TABLE IF NOT EXISTS nav_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES announcement_bars(id) ON DELETE CASCADE,
    text VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    position VARCHAR(20) DEFAULT 'right', -- left or right
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES announcement_bars(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- impression, click, close
    variant VARCHAR(10), -- 'A' or 'B' for A/B testing
    device_type VARCHAR(20), -- mobile, desktop, tablet
    country VARCHAR(5), -- Country code
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address VARCHAR(50),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_bars_user ON announcement_bars(user_id);
CREATE INDEX idx_bars_active ON announcement_bars(is_active);
CREATE INDEX idx_messages_bar ON messages(bar_id);
CREATE INDEX idx_messages_dates ON messages(start_date, end_date);
CREATE INDEX idx_nav_links_bar ON nav_links(bar_id);
CREATE INDEX idx_analytics_bar ON analytics_events(bar_id);
CREATE INDEX idx_analytics_message ON analytics_events(message_id);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bars_updated_at BEFORE UPDATE ON announcement_bars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
