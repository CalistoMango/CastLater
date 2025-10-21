# Project Setup

**CastLater** - Farcaster mini-app for scheduling casts in advance.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: NextAuth + Farcaster Auth Client
- **Blockchain**: Viem, Wagmi (Base chain for USDC payments)
- **APIs**: Neynar SDK (Farcaster signing/publishing)
- **Cache** (optional): Upstash Redis

## Environment Variables

See [.env.example](../.env.example) for complete reference.

### Required

```bash
# App URLs
NEXT_PUBLIC_URL=https://your-app.vercel.app
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-hex-32>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-role-key>

# Neynar (Farcaster API)
NEYNAR_API_KEY=<your-neynar-api-key>
NEYNAR_CLIENT_ID=<your-neynar-client-id>

# Cron & Signer
CRON_SECRET=<strong-random-secret-for-cron-auth>
SEED_PHRASE=word1 word2 ... word12  # 12-word mnemonic
SPONSOR_SIGNER=true
FARCASTER_DEVELOPER_FID=123

# Payments
NEXT_PUBLIC_PAYMENT_RECEIVER_ADDRESS=0x0000000000000000000000000000000000000000
```

### Optional

```bash
# Redis KV (both required if used)
KV_REST_API_URL=https://your-redis.upstash.io
KV_REST_API_TOKEN=your-token

# Solana (optional feature)
SOLANA_RPC_ENDPOINT=https://solana-rpc.publicnode.com

# Deployment
USE_TUNNEL=false
VERCEL_ENV=production
VERCEL_PROJECT_PRODUCTION_URL=your-app.vercel.app
PORT=3000
```

## Environment Validation

All env vars validated via Zod schemas (fail-fast at build time):

- **Server-side**: [src/lib/env.server.ts](../src/lib/env.server.ts)
- **Public/client**: [src/lib/env.public.ts](../src/lib/env.public.ts)

Build crashes with detailed errors if validation fails.

## Database Setup

1. Create Supabase project at https://supabase.com
2. Run [db/schema.sql](../db/schema.sql) in SQL Editor to create:
   - Tables: `users`, `scheduled_casts`, `payments`
   - Indexes: Performance indexes on status, time, FID
   - Functions: `increment_casts_used()`, `update_updated_at_column()`
   - Triggers: Auto-update timestamps
   - RLS policies: Public read, service-role write

See [DATA_MODEL.md](./DATA_MODEL.md) for schema details.

## Local Development

```bash
npm install
npm run dev  # Runs scripts/dev.js (with optional tunnel)
```

The dev script auto-configures a local tunnel if `USE_TUNNEL=true`.

## Deployment (Vercel)

```bash
npm run deploy:vercel  # Uses scripts/deploy.ts
# Or: vercel --prod
```

### Cron Job Setup (Critical)

The app requires a cron job to publish scheduled casts.

**Option 1: Vercel Cron**

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-casts",
    "schedule": "*/2 * * * *"
  }]
}
```

**Option 2: External Scheduler (e.g., cron-job.org)**

- **URL**: `https://your-app.vercel.app/api/cron/send-casts`
- **Method**: GET
- **Header**: `Authorization: Bearer <CRON_SECRET>`
- **Frequency**: Every 1-2 minutes

**Implementation**: [src/app/api/cron/send-casts/route.ts](../src/app/api/cron/send-casts/route.ts)

## Authentication Flow

1. User opens app in Warpcast → Farcaster mini-app context provides FID
2. [HomePage.tsx](../src/components/HomePage.tsx) checks `context.user.fid`
3. If user not in DB → [AuthFlow.tsx](../src/components/AuthFlow.tsx)
4. `POST /api/auth/create-signer` creates Neynar signer
5. User approves signer in Warpcast
6. Signer UUID stored in `users.signer_uuid`
7. [Dashboard.tsx](../src/components/Dashboard.tsx) renders

## Payment Flow (USDC on Base)

1. User clicks "Upgrade for 10 USDC" in Dashboard
2. Wagmi triggers ERC-20 `transfer()` to receiver address
3. Frontend waits for transaction receipt
4. `POST /api/payments/record` validates tx on Base (3s delay + verification)
5. Updates `users.plan = 'unlimited'`
6. Payment record inserted with `status = 'completed'`

**USDC Contract**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base)

## Cron Job Logic

`GET /api/cron/send-casts` (requires `Authorization: Bearer <CRON_SECRET>`):

1. Fetch pending casts: `status = 'pending' AND scheduled_time <= now()` (limit 50)
2. For each cast:
   - Publish via `neynarClient.publishCast({ signerUuid, text })`
   - Update `status = 'sent'`, `cast_hash`, `sent_at`
   - Increment `casts_used` for free users (via RPC)
3. On failure: update `status = 'failed'`, `error_message`

## Frontend Structure

**Entry**: [src/app/page.tsx](../src/app/page.tsx) → [HomePage.tsx](../src/components/HomePage.tsx)

**Key Components**:
- **HomePage.tsx**: Auth router (checks FID, loads user, routes to AuthFlow or Dashboard)
- **AuthFlow.tsx**: Signer creation + approval flow with polling
- **Dashboard.tsx**: Main UI (schedule form, cast list, upgrade button)

**Routes**:
- `/` - Home page
- `/share/[fid]` - Dynamic OG images for sharing
- `/.well-known/farcaster.json` - Farcaster manifest
- `/api/opengraph-image` - OG image generator

## File Structure

```
/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Signer creation, session
│   │   │   ├── casts/        # Schedule, list, cancel
│   │   │   ├── cron/         # Background publishing
│   │   │   ├── payments/     # Payment verification
│   │   │   └── users/        # User data
│   │   ├── page.tsx          # Entry point
│   │   └── share/[fid]/      # Dynamic OG pages
│   ├── components/
│   │   ├── HomePage.tsx
│   │   ├── AuthFlow.tsx
│   │   ├── Dashboard.tsx
│   │   └── ui/               # UI primitives
│   ├── lib/
│   │   ├── auth.ts           # NextAuth config
│   │   ├── env.*.ts          # Env validation
│   │   ├── supabase.ts       # DB client
│   │   ├── neynar.ts         # Neynar SDK
│   │   ├── constants.ts      # App constants
│   │   └── kv.ts             # Redis/memory KV
│   └── hooks/                # React hooks
├── db/
│   └── schema.sql            # PostgreSQL schema
├── supabase/
│   └── schema.sql            # Full Supabase dump
└── public/                   # Static assets
```

## Key Constants

See [src/lib/constants.ts](../src/lib/constants.ts):

- `APP_NAME = 'CastLater'`
- `PAYMENT_CONFIG.PRICE = '10'` (10 USDC)
- `PAYMENT_CONFIG.USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'`
- `PAYMENT_CONFIG.DECIMALS = 6`
- `USE_WALLET = true`
- `ANALYTICS_ENABLED = false`

## Farcaster Mini-App Integration

- **Manifest**: `/.well-known/farcaster.json`
- **Context**: Auto-injected by Warpcast (`window.farcaster`)
- **Wallet**: Auto-connects Farcaster Frame wallet
- **Metadata**: OG images, Farcaster frame tags

## Tips & Gotchas

- Free plan defaults to `max_free_casts = 1`
- Cast content limited to 320 characters (DB + API enforced)
- Scheduled time must be in future (API validation)
- Payment verification waits 3 seconds before checking tx
- Supabase service key bypasses RLS (API uses admin access)
- `casts_used` is additive only (never decrements)
- Cron requires Bearer token auth (set `CRON_SECRET`)

## Common Issues

**"No FID in context"**: App must be opened in Warpcast.

**Signer approval stuck**: Check Neynar dashboard, user may need to retry.

**Casts not sending**: Verify cron is running and `CRON_SECRET` matches.

**Payment fails**: Ensure wallet on Base network with USDC balance.

## Scripts

- `npm run dev` - Dev server (with tunnel if `USE_TUNNEL=true`)
- `npm run build` - Production build
- `npm run lint` - ESLint
- `npm run deploy:vercel` - Deploy via Vercel SDK
