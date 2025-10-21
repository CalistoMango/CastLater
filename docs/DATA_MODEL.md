# Data Model

Database: **PostgreSQL** (via Supabase)
Schema: [db/schema.sql](../db/schema.sql)

## Tables

### `users`

Farcaster user profiles and app state.

```sql
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
```

**Indexes:**
- `idx_users_signer` on `signer_uuid`

**Constraints:**
- PK: `fid` (Farcaster ID)
- UNIQUE: `signer_uuid`
- CHECK: `plan IN ('free', 'unlimited')`

**Invariants:**
- `fid` is immutable (Farcaster ID)
- `casts_used` only increments, never decrements (additive only)
- `casts_used` only incremented for `plan='free'` users
- `signer_uuid` NULL until user approves signer in Warpcast

**Lifecycle:**
1. Created on first auth: `fid`, `username`, `display_name`, `pfp_url`, `custody_address`
2. Signer approved: `signer_uuid` set
3. Payment processed: `plan='unlimited'`
4. Cast sent (free users): `casts_used` +1

---

### `scheduled_casts`

Scheduled casts (pending or already sent).

```sql
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
```

**Indexes:**
- `idx_scheduled_casts_status` on `status`
- `idx_scheduled_casts_time` on `scheduled_time`
- `idx_scheduled_casts_fid_status` on `(fid, status)`

**Constraints:**
- PK: `id` (UUID)
- FK: `fid` → `users(fid)` ON DELETE CASCADE
- CHECK: `char_length(content) <= 320`
- CHECK: `status IN ('pending', 'sent', 'failed', 'cancelled')`

**Triggers:**
- `update_updated_at_column()` BEFORE UPDATE

**Invariants:**
- `status='pending'` → `scheduled_time` in future (at creation)
- `status='sent'` → `cast_hash` NOT NULL AND `sent_at` NOT NULL
- `status='failed'` → `error_message` typically set
- Once `status='sent'`, cannot transition to other states
- `status='cancelled'` only if previously `'pending'`

**Lifecycle:**
1. Created: `status='pending'`, `scheduled_time` in future
2. Cron picks up: `scheduled_time <= NOW()`
3. Published: `status='sent'`, `cast_hash` set, `sent_at` set
4. Failed: `status='failed'`, `error_message` set
5. User cancels: `status='cancelled'` (only from `'pending'`)

---

### `payments`

Payment records for plan upgrades.

```sql
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
```

**Indexes:**
- `idx_payments_fid` on `fid`
- `idx_payments_tx` on `transaction_hash`

**Constraints:**
- PK: `id` (UUID)
- UNIQUE: `transaction_hash`
- FK: `fid` → `users(fid)` ON DELETE CASCADE
- CHECK: `status IN ('pending', 'completed', 'failed')`

**Invariants:**
- `transaction_hash` is unique across all payments
- `amount` = 10.00000000 USDC for current pricing
- `network` = 'base' (hardcoded in app)
- Payment verification includes 3-second delay before checking blockchain
- Once `status='completed'`, user `plan='unlimited'`

**Lifecycle:**
1. User initiates payment via wallet
2. Created: `transaction_hash`, `from_address`, `amount`, `status='pending'`
3. API waits 3s, verifies on Base chain
4. Verified: `status='completed'`, `completed_at` set
5. Failed verification: `status='failed'`

---

## Relationships

```
users (1) ──< (N) scheduled_casts
  └─ FK: scheduled_casts.fid → users.fid (ON DELETE CASCADE)

users (1) ──< (N) payments
  └─ FK: payments.fid → users.fid (ON DELETE CASCADE)
```

**Cascade behavior**: Deleting user deletes all their casts and payment records.

---

## Functions & Triggers

### `increment_casts_used(user_fid BIGINT)`

Increments `casts_used` counter for free-tier users.

```sql
CREATE OR REPLACE FUNCTION increment_casts_used(user_fid BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET casts_used = casts_used + 1
  WHERE fid = user_fid AND plan = 'free';
END;
$$ LANGUAGE plpgsql;
```

**Called by**: [src/app/api/cron/send-casts/route.ts](../src/app/api/cron/send-casts/route.ts) after successful cast publication.

### `update_updated_at_column()`

Auto-updates `updated_at` timestamp on row modification.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Attached to**:
- `users` (BEFORE UPDATE)
- `scheduled_casts` (BEFORE UPDATE)

---

## Row Level Security (RLS)

All tables have RLS enabled.

### `users`
```sql
CREATE POLICY "Anyone can read users"
  ON users FOR SELECT
  USING (true);
```

### `scheduled_casts`
```sql
CREATE POLICY "Users can read own casts"
  ON scheduled_casts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own casts"
  ON scheduled_casts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own casts"
  ON scheduled_casts FOR UPDATE
  USING (true);
```

### `payments`
```sql
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (true);
```

**Note**: Policies are permissive (`true`) because API routes use service-role key (bypasses RLS). Authorization enforced in API layer via FID matching.

For production, consider tightening:
```sql
-- Example stricter policy (not currently implemented):
CREATE POLICY "Users can only see own casts"
  ON scheduled_casts FOR SELECT
  USING (fid = current_setting('app.current_user_fid')::BIGINT);
```

---

## Business Rules (Data Level)

1. **Free tier limit**: `casts_used < max_free_casts` to schedule new cast
2. **Unlimited tier**: No limit check if `plan='unlimited'`
3. **Signer required**: `signer_uuid NOT NULL` to schedule casts
4. **Future scheduling**: `scheduled_time > NOW()` at creation
5. **Character limit**: Content ≤ 320 chars (Farcaster protocol limit)
6. **Payment uniqueness**: One tx hash = one payment (prevents double-crediting)
7. **Cast immutability**: Once `status='sent'`, content/time cannot change
8. **Cancellation window**: Only `status='pending'` casts can be cancelled

---

## Query Patterns

**List user's pending casts:**
```sql
SELECT * FROM scheduled_casts
WHERE fid = $1 AND status = 'pending'
ORDER BY scheduled_time ASC;
```

**Find due casts (cron):**
```sql
SELECT * FROM scheduled_casts
WHERE status = 'pending'
  AND scheduled_time <= NOW()
ORDER BY scheduled_time ASC
LIMIT 50;
```

**Check free tier limit:**
```sql
SELECT casts_used, max_free_casts, plan FROM users
WHERE fid = $1;
```

**Verify payment uniqueness:**
```sql
SELECT id FROM payments
WHERE transaction_hash = $1;
```

---

## Invariants Summary

1. **FID Uniqueness**: `users.fid` is primary key
2. **Signer Uniqueness**: `users.signer_uuid` is unique
3. **Cast Ownership**: Every `scheduled_casts` belongs to a user
4. **Payment Idempotency**: `payments.transaction_hash` is unique
5. **Plan Enum**: `users.plan` only allows `'free'` or `'unlimited'`
6. **Status Enums**: CHECK constraints on status columns
7. **Content Length**: Casts limited to 320 chars
8. **Free Plan Counter**: `casts_used` increments only when `plan='free'`
9. **Cascade Deletes**: Deleting user cascades to casts and payments
10. **Additive Counter**: `casts_used` never decrements automatically
