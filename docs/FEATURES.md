# Features & Business Rules

Core functionality and invariants for CastLater.

## User Plans

### Free Plan
- **Default**: All new users start on `plan = 'free'`
- **Limit**: `max_free_casts = 1` (configurable per user)
- **Counter**: `casts_used` increments after each **successful cast send**
- **Restriction**: Cannot schedule when `casts_used >= max_free_casts`
- **Upgrade Path**: Pay 10 USDC on Base → unlimited plan

### Unlimited Plan
- **Triggered By**: Payment of 10 USDC to receiver address
- **Benefits**: No limit on scheduled casts
- **Counter**: `casts_used` stops incrementing
- **Downgrade**: Not supported (permanent upgrade)

### Invariants
- `plan` ENUM: only `'free'` or `'unlimited'` allowed (DB constraint)
- `casts_used` is **additive only** (never decreases automatically)
- Free users cannot bypass limit (enforced in `POST /api/casts/schedule`)
- Counter increments **only on successful send**, not on schedule or failure

---

## Cast Scheduling

### Rules
1. **Content Limit**: 320 characters max (enforced in DB + API)
2. **Future Only**: `scheduled_time` must be `> now()` (API validation)
3. **Requires Signer**: User must have `signer_uuid` from Neynar
4. **Status Lifecycle**: `pending` → `sent` | `failed` | `cancelled`

### Status Transitions
- `pending`: Initial state after scheduling
- `sent`: Published by cron job (has `cast_hash`, `sent_at`)
- `failed`: Neynar API error (has `error_message`)
- `cancelled`: User cancelled before send

**Allowed transitions:**
- `pending → sent`
- `pending → failed`
- `pending → cancelled`

**Forbidden transitions:**
- `sent → *` (immutable)
- `failed → sent` (no retry logic)
- `cancelled → pending` (no undo)

### Edge Cases
- **Duplicate Scheduling**: Allowed (no dedup logic)
- **Past Time**: Rejected with `400` error
- **No Signer**: Rejected with `403` error ("No signer found")
- **Free Limit**: Rejected with `403` + upgrade prompt
- **Empty Content**: Rejected with `400` error

### Invariants
- `content.length <= 320` (DB constraint + API check)
- `status IN ('pending', 'sent', 'failed', 'cancelled')` (DB constraint)
- `cast_hash` non-null only when `status = 'sent'`
- `sent_at` non-null only when `status = 'sent'`
- `error_message` non-null only when `status = 'failed'`

---

## Payment & Upgrades

### Payment Flow
1. User clicks "Upgrade for 10 USDC" → Wagmi wallet connection
2. ERC-20 `transfer()` called: 10 USDC to `PAYMENT_CONFIG.RECEIVER`
3. Frontend waits for tx receipt (Base L2)
4. `POST /api/payments/record` validates receipt
5. Payment inserted with `status = 'completed'`
6. User plan updated to `'unlimited'`

### Validation
- **Idempotency**: `transaction_hash` must be unique (DB constraint)
- **Network**: Only Base supported (`network = 'base'`)
- **Token**: Only USDC supported (`token = 'USDC'`)
- **Amount**: 10 USDC (6 decimals: `10000000`)
- **Receipt Check**: 3-second delay then verify `receipt.status === 'success'`

### Edge Cases
- **Duplicate TX**: Returns `400` ("Payment already recorded")
- **Failed TX**: Returns `400` ("Transaction failed")
- **Wrong Network**: Not validated (assumes Base via frontend)
- **Insufficient Balance**: Fails at wallet level (not API)
- **Overpayment**: Accepted (no refund logic)

### Invariants
- `transaction_hash` unique per payment (prevents double-credit)
- `amount = 10` for all upgrades (hardcoded in API)
- `status IN ('pending', 'completed', 'failed')` (DB constraint)
- `completed_at` set only when `status = 'completed'`
- Payment → plan upgrade is atomic (same transaction)

---

## Cron Job (Cast Publishing)

### Schedule
- **Recommended**: Every 1-2 minutes
- **Endpoint**: `GET /api/cron/send-casts`
- **Auth**: `Authorization: Bearer <CRON_SECRET>`

### Logic
1. Fetch casts: `status = 'pending' AND scheduled_time <= now()` (limit 50)
2. Publish each via Neynar: `publishCast({ signerUuid, text })`
3. Update `status = 'sent'`, `cast_hash`, `sent_at`
4. Increment `casts_used` for free users (RPC call)
5. On error: set `status = 'failed'`, `error_message`

### Edge Cases
- **No Pending Casts**: Returns `processed: 0` (success)
- **Neynar API Down**: Cast marked `failed` with error message
- **Invalid Signer**: Cast marked `failed`
- **Partial Batch**: Processes all 50, some may succeed/fail
- **Concurrent Cron Runs**: Not prevented (could cause duplicate publishes)

### Invariants
- Cron only processes casts where `scheduled_time <= now()`
- Free users' counter increments exactly once per successful cast
- Failed casts retain `status = 'failed'` (no auto-retry)
- Cast hash only set on successful publish

### TODO
- Add distributed lock to prevent concurrent cron runs
- Add retry logic for transient Neynar errors
- Consider exponential backoff for rate limits

---

## Signer Management

### Creation
- Triggered by [AuthFlow.tsx](../src/components/AuthFlow.tsx)
- Calls `POST /api/auth/create-signer`
- Returns `signer_approval_url` for Warpcast deeplink
- User approves in Warpcast app
- Polling via `GET /api/auth/signer-status` (every 2s)

### Storage
- `signer_uuid` stored in `users.signer_uuid` (unique constraint)
- Used for all cast publishing via Neynar API

### Edge Cases
- **Lost Signer**: User must re-approve (no revoke/re-create flow yet)
- **Multiple Signers**: Not supported (one per user)
- **Signer Expiry**: Not handled (assumes perpetual validity)
- **Approval Timeout**: No timeout (user can retry)

### Invariants
- Each user has exactly one signer (unique constraint)
- Signer required to schedule casts (enforced in API)
- Signer approval URL valid for ~24 hours (Neynar default)

---

## Farcaster Mini-App Context

### Context Provided
- `context.user.fid`: User's Farcaster ID
- Auto-injected by Warpcast when app is opened
- Accessed via `useMiniApp()` from `@neynar/react`

### Wallet Auto-Connect
- If `context.user.fid` exists → auto-connect Farcaster Frame wallet
- Uses first connector (wagmi): `connectors[0]`
- Only triggers if `window.farcaster` is defined

### Edge Cases
- **No Context**: Show "Open in Warpcast" message
- **Non-Warpcast Browser**: Detect via `window.farcaster` check
- **Context Lag**: Loading state shown until FID available

### Invariants
- App requires Farcaster context to function
- FID is source of truth for user identity (no email/password)

---

## Notifications (Optional)

### Implementation
- Function: `sendNeynarMiniAppNotification({ fid, title, body })`
- Uses Neynar's `publishFrameNotifications` API
- Stores notification tokens in KV storage (Redis or in-memory)

### Webhook Events
- `notifications_enabled`: Store notification details
- `notifications_disabled`: Delete notification details
- `miniapp_added`: Send welcome notification
- `miniapp_removed`: Clean up notification data

### Edge Cases
- **No Notification Token**: User hasn't enabled notifications
- **Rate Limited**: Neynar API throttling
- **API Error**: Logged but doesn't block core flow

### TODO
- Integrate notification sending after cast publish
- Add user preference toggle for notifications

---

## Feature Flags

See [src/lib/constants.ts](../src/lib/constants.ts):

- `USE_WALLET = true`: Wallet functionality enabled
- `ANALYTICS_ENABLED = false`: Analytics disabled
- `APP_REQUIRED_CHAINS = []`: No required chains (flexible)

---

## Known Limitations

1. **No Cast Editing**: Once scheduled, content cannot be changed (only cancel)
2. **No Recurring Casts**: Each cast is one-time only
3. **No Draft Saving**: Form state lost on refresh
4. **No Multi-Account**: One signer per FID (no account switching)
5. **No Timezone Support**: All times in UTC (user must convert)
6. **Cron Precision**: 1-minute granularity (seconds ignored)
7. **Payment Network**: Base only (no multi-chain support)
8. **No Refunds**: Plan upgrades are permanent (no downgrade/refund flow)
9. **No Retry Logic**: Failed casts must be manually rescheduled
10. **No Concurrent Cron Protection**: Multiple cron runs could duplicate publishes

---

## Testing Scenarios

### Free Tier Limit
1. New user schedules 1 cast → succeeds
2. User tries to schedule 2nd cast → rejected with upgrade prompt
3. First cast is sent → `casts_used = 1`
4. User still cannot schedule → must upgrade

### Payment Flow
1. User pays 10 USDC on Base → `plan='unlimited'`
2. User can now schedule unlimited casts
3. `casts_used` no longer increments

### Cancellation
1. Schedule 3 casts (unlimited user)
2. Cancel 1st cast → `status='cancelled'`
3. 2nd and 3rd casts still publish on schedule

### Signer Revocation
1. User approves signer → schedules casts
2. User revokes signer in Warpcast
3. Scheduled casts fail at publish time with "Invalid signer" error

### Concurrent Scheduling
1. Free user with 0 casts_used
2. Schedules 1 cast → succeeds
3. Immediately schedules 2nd cast (before first sends) → succeeds
4. Both casts pending, will both send
5. After both send: `casts_used = 2` (exceeded limit retroactively)

**Note**: This is a race condition - free tier limit is checked at schedule time, not send time.
