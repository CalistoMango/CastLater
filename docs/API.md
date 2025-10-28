# API Reference

Base URL: `https://your-domain.com` (or `http://localhost:3000` for dev)

All routes return JSON. Standard error format:

```json
{
  "error": "Error message",
  "details": "Optional details"
}
```

---

## Authentication Routes

### `POST /api/auth/create-signer`

Creates Neynar signer and upserts user.

**Request:**
```json
{
  "fid": 12345,
  "username": "alice",
  "display_name": "Alice",
  "pfp_url": "https://...",
  "custody_address": "0x..."
}
```

**Response (200):**
```json
{
  "signer_uuid": "abc-123",
  "signer_approval_url": "https://client.warpcast.com/deeplinks/sign-in-with-farcaster?...",
  "public_key": "0x...",
  "user": {
    "fid": 12345,
    "username": "alice",
    "plan": "free",
    "casts_used": 0,
    "max_free_casts": 1
  }
}
```

**Errors:**
- `400`: FID required
- `500`: Failed to create signer or upsert user

**Implementation**: [src/app/api/auth/create-signer/route.ts](../src/app/api/auth/create-signer/route.ts)

---

### `GET /api/auth/signer-status?signer_uuid=abc-123`

Polls signer approval status.

**Query Params:**
- `signer_uuid` (required)

**Response (pending):**
```json
{
  "status": "pending_approval",
  "fid": null
}
```

**Response (approved):**
```json
{
  "status": "approved",
  "fid": 12345
}
```

**Side effect**: Updates user's `signer_uuid` when approved.

**Implementation**: [src/app/api/auth/signer-status/route.ts](../src/app/api/auth/signer-status/route.ts)

---

## User Routes

### `GET /api/users?fids=123,456`

Bulk fetch users from Neynar API.

**Query Params:**
- `fids` (required): comma-separated FID list

**Response (200):**
```json
{
  "users": [
    {
      "fid": 123,
      "username": "alice",
      "display_name": "Alice",
      "pfp_url": "https://..."
    }
  ]
}
```

**Errors:**
- `400`: FIDs parameter required
- `500`: Neynar API error

**Implementation**: [src/app/api/users/route.ts](../src/app/api/users/route.ts)

---

### `GET /api/users/[fid]`

Fetch user record from Supabase.

**Params:**
- `fid`: Farcaster ID (URL parameter)

**Response (200):**
```json
{
  "user": {
    "fid": 12345,
    "username": "alice",
    "display_name": "Alice",
    "pfp_url": "https://...",
    "signer_uuid": "abc-123",
    "plan": "free",
    "casts_used": 2,
    "max_free_casts": 1,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `404`: User not found
- `500`: Database error

**Implementation**: [src/app/api/users/[fid]/route.ts](../src/app/api/users/[fid]/route.ts)

---

## Cast Management Routes

### `POST /api/casts/schedule`

Schedules a new cast for future publishing.

**Request:**
```json
{
  "fid": 12345,
  "content": "Hello Farcaster!",
  "scheduled_time": "2025-10-21T15:30:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "cast": {
    "id": "uuid-here",
    "fid": 12345,
    "content": "Hello Farcaster!",
    "scheduled_time": "2025-10-21T15:30:00.000Z",
    "status": "pending",
    "created_at": "2025-10-21T10:00:00.000Z"
  }
}
```

**Validation:**
- `scheduled_time` must be in the future
- `content` max 320 characters
- User must have `signer_uuid`
- Free users: `casts_used < max_free_casts`

**Errors:**
- `400`: Missing fields / invalid time / content too long
- `403`: No signer found / free limit reached
- `404`: User not found
- `500`: Database error

**Implementation**: [src/app/api/casts/schedule/route.ts](../src/app/api/casts/schedule/route.ts)

---

### `GET /api/casts/list?fid=12345`

Lists user's scheduled casts.

**Query Params:**
- `fid` (required): Farcaster ID

**Response (200):**
```json
{
  "casts": [
    {
      "id": "uuid-1",
      "fid": 12345,
      "content": "Future cast",
      "scheduled_time": "2025-10-22T10:00:00Z",
      "status": "pending",
      "created_at": "2025-10-21T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "fid": 12345,
      "content": "Past cast",
      "scheduled_time": "2025-10-20T10:00:00Z",
      "status": "sent",
      "cast_hash": "0xabc...",
      "sent_at": "2025-10-20T10:00:05Z"
    }
  ]
}
```

**Filters:**
- `status IN ('pending', 'sent', 'failed')`
- Order by `scheduled_time DESC`
- Limit: 50

**Errors:**
- `400`: Missing or invalid FID
- `500`: Database error

**Implementation**: [src/app/api/casts/list/route.ts](../src/app/api/casts/list/route.ts)

---

### `POST /api/casts/cancel`

Cancels a pending cast.

**Request:**
```json
{
  "cast_id": "uuid-here",
  "fid": 12345
}
```

**Response (200):**
```json
{
  "success": true,
  "cast": {
    "id": "uuid-here",
    "status": "cancelled"
  }
}
```

**Validation:**
- Cast must exist
- Cast must belong to `fid`
- `status` must be `'pending'`

**Errors:**
- `400`: Missing fields
- `403`: Not your cast / cannot cancel (already sent/failed)
- `404`: Cast not found
- `500`: Database error

**Implementation**: [src/app/api/casts/cancel/route.ts](../src/app/api/casts/cancel/route.ts)

---

## Payment Routes

### `POST /api/payments/record`

Records and verifies USDC payment for plan upgrade.

**Request:**
```json
{
  "fid": 12345,
  "txHash": "0xabc123...",
  "address": "0xuser..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified and user upgraded to unlimited!"
}
```

**Flow:**
1. Check if `txHash` already recorded (idempotency)
2. Wait 3 seconds for tx propagation
3. Fetch transaction receipt from Base RPC
4. Verify `receipt.status === 'success'`
5. Insert payment record (`amount: 10`, `status: 'completed'`)
6. Update `users.plan = 'unlimited'`

**Errors:**
- `400`: Missing fields / payment already recorded / transaction failed
- `500`: Database error / RPC error

**Implementation**: [src/app/api/payments/record/route.ts](../src/app/api/payments/record/route.ts)

---

## Cron Routes

### `GET /api/cron/send-casts`

Processes pending casts (cron job endpoint).

**Auth:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response (200):**
```json
{
  "success": true,
  "processed": 5,
  "results": [
    { "cast_id": "uuid-1", "status": "sent", "hash": "0xabc..." },
    { "cast_id": "uuid-2", "status": "failed", "error": "Invalid signer" }
  ],
  "timestamp": "2025-10-21T15:00:00.000Z"
}
```

**Logic:**
1. Fetch pending casts: `status = 'pending' AND scheduled_time <= now()` (limit 50)
2. For each cast:
   - Publish via `neynarClient.publishCast({ signerUuid, text })`
   - Update `status = 'sent'`, `cast_hash`, `sent_at`
   - Increment `casts_used` for free users (via RPC)
   - On error: update `status = 'failed'`, `error_message`

**Errors:**
- `401`: Unauthorized (bad CRON_SECRET)
- `500`: Job failed

**Implementation**: [src/app/api/cron/send-casts/route.ts](../src/app/api/cron/send-casts/route.ts)

---

## Auth Helper Routes

### `GET /api/auth/nonce`

Fetches a nonce from Neynar for authentication.

**Response (200):**
```json
{
  "nonce": "random-nonce-string"
}
```

**Errors:**
- `500`: Failed to fetch nonce

**Implementation**: [src/app/api/auth/nonce/route.ts](../src/app/api/auth/nonce/route.ts)

---

### `POST /api/auth/validate`

Validates a QuickAuth JWT token.

**Request:**
```json
{
  "token": "jwt-token-string"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "fid": 12345
  }
}
```

**Errors:**
- `400`: Token required
- `401`: Invalid token
- `500`: Internal server error

**Implementation**: [src/app/api/auth/validate/route.ts](../src/app/api/auth/validate/route.ts)

---

### `POST /api/auth/get-fid`

Looks up FID by Ethereum address.

**Request:**
```json
{
  "address": "0x..."
}
```

**Response (200):**
```json
{
  "fid": 12345,
  "username": "alice",
  "display_name": "Alice",
  "pfp_url": "https://...",
  "custody_address": "0x...",
  "verified_addresses": {}
}
```

**Errors:**
- `400`: Address required
- `404`: No Farcaster account found
- `500`: Failed to get FID

**Implementation**: [src/app/api/auth/get-fid/route.ts](../src/app/api/auth/get-fid/route.ts)

---

### `POST /api/auth/signer` & `GET /api/auth/signer?signerUuid=...`

Create or lookup a Neynar signer.

**POST Response:**
```json
{
  "signer_uuid": "abc-123",
  "signer_approval_url": "https://...",
  "public_key": "0x..."
}
```

**GET Response:**
```json
{
  "status": "approved",
  "fid": 12345
}
```

**Implementation**: [src/app/api/auth/signer/route.ts](../src/app/api/auth/signer/route.ts)

---

### `GET /api/auth/signers?message=...&signature=...`

Fetches signers associated with a message/signature pair.

**Query Params:**
- `message` (required)
- `signature` (required)

**Response (200):**
```json
{
  "signers": [...]
}
```

**Implementation**: [src/app/api/auth/signers/route.ts](../src/app/api/auth/signers/route.ts)

---

### `GET /api/auth/session-signers?message=...&signature=...`

Fetches signers and associated user data.

**Response (200):**
```json
{
  "signers": [...],
  "user": {
    "fid": 12345,
    "username": "alice"
  }
}
```

**Implementation**: [src/app/api/auth/session-signers/route.ts](../src/app/api/auth/session-signers/route.ts)

---

### `POST /api/auth/signer/signed_key`

Registers a signed key for sponsored signers.

**Request:**
```json
{
  "signerUuid": "abc-123",
  "publicKey": "0x...",
  "redirectUrl": "https://..."
}
```

**Response (200):**
```json
{
  "signer_uuid": "abc-123",
  "signer_approval_url": "https://...",
  "public_key": "0x..."
}
```

**Environment Requirements:**
- `SEED_PHRASE`: App's mnemonic
- `SPONSOR_SIGNER`: Set to 'true' to enable sponsorship
- `FARCASTER_DEVELOPER_FID`: App's FID

**Implementation**: [src/app/api/auth/signer/signed_key/route.ts](../src/app/api/auth/signer/signed_key/route.ts)

---

## Other Routes

### `GET /api/best-friends?fid=12345`

Fetches user's best friends from Neynar.

**Query Params:**
- `fid` (required): Farcaster ID

**Response (200):**
```json
{
  "bestFriends": [
    {
      "user": {
        "fid": 456,
        "username": "bob"
      }
    }
  ]
}
```

**Errors:**
- `400`: FID parameter required
- `500`: Neynar API error

**Implementation**: [src/app/api/best-friends/route.ts](../src/app/api/best-friends/route.ts)

---

### `POST /api/webhook`

Receives Farcaster mini-app events from Neynar.

**Note**: Only processes webhooks when Neynar is NOT enabled (falls back to local webhook handler).

**Events:**
- `miniapp_added` - User added app
- `miniapp_removed` - User removed app
- `notifications_enabled` - User enabled notifications
- `notifications_disabled` - User disabled notifications

**Body (example):**
```json
{
  "fid": 12345,
  "event": {
    "event": "notifications_enabled",
    "notificationDetails": {
      "url": "https://...",
      "token": "..."
    }
  }
}
```

**Side effects**: Stores notification details in KV storage, sends welcome notification.

**Implementation**: [src/app/api/webhook/route.ts](../src/app/api/webhook/route.ts)

---

### `POST /api/send-notification`

Test endpoint to send a mini-app notification.

**Request:**
```json
{
  "fid": 12345,
  "notificationDetails": {
    "url": "https://...",
    "token": "..."
  }
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- `400`: Invalid request body
- `429`: Rate limited
- `500`: Notification send failed

**Implementation**: [src/app/api/send-notification/route.ts](../src/app/api/send-notification/route.ts)

---

### `GET /api/opengraph-image`

Generates dynamic OG image for sharing.

**Query Params:**
- `fid` (optional): User FID

**Returns**: PNG image

**Implementation**: [src/app/api/opengraph-image/route.tsx](../src/app/api/opengraph-image/route.tsx)

---

## Error Codes & Formats

Standard HTTP status codes:

- `200`: Success
- `400`: Bad request (validation, business rule violation)
- `401`: Unauthorized (missing/invalid auth)
- `403`: Forbidden (no signer, limit reached, not your resource)
- `404`: Resource not found
- `500`: Internal server error (DB, RPC, Neynar API)

**Common error responses:**

```json
// Validation error
{ "error": "Content must be 320 characters or less" }

// Business rule violation
{ "error": "Free plan limit reached. Upgrade to schedule more casts." }

// Auth error
{ "error": "Unauthorized" }

// Not found
{ "error": "Cast not found" }
```

---

## Example cURL Commands

**Schedule cast:**
```bash
curl -X POST https://your-app.vercel.app/api/casts/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 12345,
    "content": "Hello from cURL!",
    "scheduled_time": "2025-10-22T12:00:00.000Z"
  }'
```

**List casts:**
```bash
curl https://your-app.vercel.app/api/casts/list?fid=12345
```

**Cancel cast:**
```bash
curl -X POST https://your-app.vercel.app/api/casts/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "cast_id": "uuid-here",
    "fid": 12345
  }'
```

**Trigger cron (requires secret):**
```bash
curl https://your-app.vercel.app/api/cron/send-casts \
  -H "Authorization: Bearer your-cron-secret-here"
```

**Record payment:**
```bash
curl -X POST https://your-app.vercel.app/api/payments/record \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 12345,
    "txHash": "0xabc123...",
    "address": "0xuser..."
  }'
```
