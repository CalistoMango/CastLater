# CastLater 📅

> A Farcaster Mini App that lets users schedule casts in advance.

Built with Next.js 15, React 19, Neynar, and Supabase.

## Features

- **Schedule Casts**: Set your casts to post at specific times
- **Freemium Model**: 1 free scheduled cast, then upgrade to unlimited
- **Farcaster Authentication**: Sign in with your Farcaster account via Neynar
- **Crypto Payments**: Pay 10 USDC on Base for unlimited access
- **Automatic Posting**: Cron job sends your scheduled casts on time
- **Modern UI**: Gradient-based design with Tailwind CSS + shadcn/ui

## Tech Stack

### Core
- **Framework**: Next.js 15 (App Router)
- **Frontend**: React 19, TypeScript 5, Tailwind CSS 3
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with RLS)

### Integrations
- **Farcaster**: Neynar SDK (@neynar/nodejs-sdk 2.x)
- **Auth**: Farcaster Auth Client + QuickAuth
- **Payments**: Wagmi 2.x + Viem 2.x (Base USDC)
- **Blockchain**: Solana Web3.js (optional)
- **Cache**: Upstash Redis (optional)

### Key Dependencies
- `@farcaster/auth-kit` - Farcaster authentication
- `@farcaster/miniapp-sdk` - Mini-app context and APIs
- `@supabase/supabase-js` - Database client
- `@tanstack/react-query` - Data fetching
- `date-fns` - Date formatting
- `zod` - Environment validation

## Quick Start

### Prerequisites
- Node.js 20+
- Supabase account
- Neynar API key + Client ID
- Base wallet with USDC (for payments)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd castlater

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
# Open Supabase SQL Editor and run db/schema.sql

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) (or use tunnel with `USE_TUNNEL=true`)

### Required Environment Variables

See [`.env.example`](./.env.example) for the full list. Key variables:

```bash
NEXT_PUBLIC_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
NEYNAR_API_KEY=xxx
NEYNAR_CLIENT_ID=xxx
CRON_SECRET=xxx
SEED_PHRASE="word1 word2 ... word12"
NEXT_PUBLIC_PAYMENT_RECEIVER_ADDRESS=0x...
NEXTAUTH_SECRET=xxx
```

## Project Structure

```
castlater/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Signer creation & validation
│   │   │   ├── casts/        # Schedule, list, cancel
│   │   │   ├── cron/         # Background cast sending
│   │   │   ├── payments/     # Payment verification
│   │   │   └── users/        # User management
│   │   ├── page.tsx          # Entry point
│   │   └── providers.tsx     # React Query, Wagmi providers
│   ├── components/
│   │   ├── HomePage.tsx      # Auth router
│   │   ├── AuthFlow.tsx      # Signer creation flow
│   │   ├── Dashboard.tsx     # Main UI
│   │   └── ui/               # UI primitives (shadcn)
│   ├── lib/
│   │   ├── env.server.ts     # Server env validation
│   │   ├── env.public.ts     # Public env validation
│   │   ├── supabase.ts       # DB client
│   │   ├── neynar.ts         # Neynar SDK
│   │   └── constants.ts      # App constants
│   └── hooks/                # React hooks
├── db/
│   └── schema.sql            # Simple schema
├── supabase/
│   └── schema.sql            # Full Supabase dump
├── docs/
│   ├── API.md                # API documentation
│   ├── DATA_MODEL.md         # Database schema
│   ├── FEATURES.md           # Business rules
│   ├── PROJECT_SETUP.md      # Setup guide
│   ├── LLM.md                # LLM context
│   └── LOGBOOK.md            # Change log
└── scripts/
    ├── dev.js                # Dev server (with tunnel)
    └── deploy.ts             # Vercel deployment
```

## Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Data Model](./docs/DATA_MODEL.md)** - Database schema & relationships
- **[Features & Rules](./docs/FEATURES.md)** - Business logic & invariants
- **[Setup Guide](./docs/PROJECT_SETUP.md)** - Detailed setup instructions
- **[Change Log](./docs/LOGBOOK.md)** - Development history

## Deployment

### Vercel (Recommended)

```bash
npm run deploy:vercel
```

Or manually:
```bash
vercel --prod
```

### Environment Variables
Configure all variables from `.env.example` in Vercel dashboard.

### Cron Job Setup
The app requires a cron job to publish scheduled casts:

**Option 1: Vercel Cron** (if available)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-casts",
    "schedule": "*/2 * * * *"
  }]
}
```

**Option 2: External Scheduler**
- URL: `https://your-app.vercel.app/api/cron/send-casts`
- Method: GET
- Header: `Authorization: Bearer <CRON_SECRET>`
- Frequency: Every 1-2 minutes

## Development

### Available Scripts

- `npm run dev` - Start dev server (with optional tunnel)
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run deploy:vercel` - Deploy via Vercel SDK
- `npm run cleanup` - Cleanup script

### Database Setup

1. Create a Supabase project
2. Run `db/schema.sql` in SQL Editor
3. Copy connection details to `.env.local`

See [docs/PROJECT_SETUP.md](./docs/PROJECT_SETUP.md) for detailed instructions.

## How It Works

1. **Authentication**: User opens app in Warpcast → Farcaster context provides FID
2. **Signer Creation**: User approves Neynar signer for cast publishing
3. **Scheduling**: User writes cast + sets time → stored in database
4. **Publishing**: Cron job checks for due casts every 1-2 minutes → publishes via Neynar
5. **Payment**: Users can upgrade to unlimited by paying 10 USDC on Base

## License

This project is based on [@neynar/create-farcaster-mini-app](https://github.com/neynar-labs/create-farcaster-mini-app) template.

## Support

- GitHub Issues: [Report bugs](https://github.com/YOUR_USERNAME/castlater/issues)
- Neynar Docs: [https://docs.neynar.com](https://docs.neynar.com)
- Farcaster: [https://docs.farcaster.xyz](https://docs.farcaster.xyz)
