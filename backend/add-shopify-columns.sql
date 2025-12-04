ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_shop VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_access_token TEXT;
CREATE INDEX IF NOT EXISTS idx_users_shopify_shop ON users(shopify_shop);
