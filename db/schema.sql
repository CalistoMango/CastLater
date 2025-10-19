-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  fid BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  custody_address TEXT,
  verified_addresses JSONB,
  signer_uuid TEXT UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'unlimited')),
  casts_used INTEGER DEFAULT 0,
  max_free_casts INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled casts table
CREATE TABLE scheduled_casts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fid BIGINT REFERENCES users(fid) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 320),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  cast_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fid BIGINT REFERENCES users(fid) ON DELETE CASCADE,
  transaction_hash TEXT UNIQUE NOT NULL,
  from_address TEXT,
  amount DECIMAL(18, 8) NOT NULL,
  token TEXT DEFAULT 'USDC',
  network TEXT DEFAULT 'base',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_scheduled_casts_status ON scheduled_casts(status);
CREATE INDEX idx_scheduled_casts_time ON scheduled_casts(scheduled_time);
CREATE INDEX idx_scheduled_casts_fid_status ON scheduled_casts(fid, status);
CREATE INDEX idx_users_signer ON users(signer_uuid);
CREATE INDEX idx_payments_fid ON payments(fid);
CREATE INDEX idx_payments_tx ON payments(transaction_hash);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_casts_updated_at
  BEFORE UPDATE ON scheduled_casts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function for incrementing casts
CREATE OR REPLACE FUNCTION increment_casts_used(user_fid BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET casts_used = casts_used + 1
  WHERE fid = user_fid AND plan = 'free';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_casts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can read all user data
CREATE POLICY "Anyone can read users"
  ON users FOR SELECT
  USING (true);

-- Scheduled casts policies
CREATE POLICY "Users can read own casts"
  ON scheduled_casts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own casts"
  ON scheduled_casts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own casts"
  ON scheduled_casts FOR UPDATE
  USING (true);

-- Payments read policies
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (true);
