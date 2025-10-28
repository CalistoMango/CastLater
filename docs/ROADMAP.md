# CastLater Roadmap

**Last Updated**: 2025-10-27
**Status**: Pre-launch (not deployed yet)
**Timeline**: 1 week to launch

---

## Current Status

### ✅ **Fully Implemented & Working**

**Core Features:**
- Complete cast scheduling system (schedule, list, cancel)
- Automated cast publishing via cron job
- Farcaster authentication via Neynar
- Signer creation and management
- Freemium model (1 free cast, unlimited paid tier)
- USDC payment integration on Base ($10 for unlimited access)
- Payment verification with blockchain confirmation

**Technical Infrastructure:**
- 20 API routes fully functional
- 3-table database schema (users, scheduled_casts, payments)
- Environment validation system (Zod-based)
- Row Level Security (RLS) policies
- TypeScript + ESLint passing
- Complete documentation (API, Data Model, Features, Setup)

**Code Quality:**
- TypeScript compilation: ✅ Clean
- ESLint: ✅ Passing (1 minor unused var warning)
- Documentation coverage: 100%

### ❌ **Not Yet Implemented**

**Critical for Launch:**
- No retry logic for failed casts
- No cast editing functionality
- Minimal signer expiry handling
- No test suite (relying on manual testing)
- Not deployed to production

**Known Issues:**
- No distributed lock (concurrent cron runs could duplicate casts)
- Free tier race condition (can schedule multiple before limit enforced)
- Failed casts must be manually rescheduled

---

## 1-Week Pre-Launch Plan

**Goal**: Launch a reliable, polished MVP with essential features.

**Priorities**: Reliability → Essential Features → Polish → Deploy

---

### **Day 1-2: Critical Reliability Improvements** 🔴 HIGH PRIORITY

#### 1. Add Retry Logic for Failed Casts ⭐ CRITICAL

**Why**: Currently failed casts just stay failed. Users can't retry and the system doesn't automatically retry.

**What to build**:
- Add database migration:
  - `retry_count` INTEGER DEFAULT 0
  - `last_retry_at` TIMESTAMP WITH TIME ZONE
  - `next_retry_at` TIMESTAMP WITH TIME ZONE
- Modify [src/app/api/cron/send-casts/route.ts](src/app/api/cron/send-casts/route.ts)
  - Implement exponential backoff (use existing `exponential-backoff` package)
  - Max 3 retries: immediate, +5min, +15min, then mark permanently failed
  - Query both `status='pending'` AND `status='failed' WHERE retry_count < 3 AND next_retry_at <= NOW()`
- Add retry button to frontend Dashboard
  - New API route: `POST /api/casts/retry` (resets retry_count)

**Files to modify**:
- `supabase/schema.sql` - add columns
- `db/schema.sql` - add columns
- `src/app/api/cron/send-casts/route.ts` - retry logic
- `src/app/api/casts/retry/route.ts` - new endpoint
- `src/components/Dashboard.tsx` - retry UI
- `docs/DATA_MODEL.md` - update schema
- `docs/API.md` - document retry endpoint

**Success criteria**:
- Failed casts automatically retry 3 times
- Users can manually trigger retry
- Exponential backoff prevents rate limit issues

---

#### 2. Improve Error Handling & Logging

**Why**: Better debugging in production, clearer user feedback.

**What to build**:
- Structured error types for common failures:
  - `RATE_LIMIT_EXCEEDED` - Neynar/Farcaster rate limits
  - `SIGNER_EXPIRED` - Signer needs re-approval
  - `SIGNER_INVALID` - Signer doesn't exist
  - `NETWORK_ERROR` - Blockchain/API timeouts
  - `CONTENT_INVALID` - Content validation failed
- Better console logging with timestamps and context
- User-friendly error messages in API responses

**Files to modify**:
- `src/lib/errors.ts` - new file with error types
- `src/app/api/cron/send-casts/route.ts` - structured errors
- `src/app/api/casts/schedule/route.ts` - better validation errors
- `src/components/Dashboard.tsx` - display error categories

**Success criteria**:
- Clear error messages in logs
- Users understand what went wrong
- Easier debugging in Vercel logs

---

#### 3. Add Basic Health Monitoring

**Why**: Know if the system is working before users complain.

**What to build**:
- New endpoint: `GET /api/health`
  - Check database connection
  - Check Neynar API connectivity
  - Return cron job last run time
  - Return system status
- Simple stats endpoint: `GET /api/stats` (optional)
  - Total scheduled casts (pending/sent/failed)
  - Total users (free/paid)
  - Last successful cron run

**Files to create**:
- `src/app/api/health/route.ts` - health check
- `src/app/api/stats/route.ts` - stats (optional)
- `docs/API.md` - document endpoints

**Success criteria**:
- Can ping `/api/health` to verify system status
- Dashboard shows last cron run time

---

### **Day 3-4: Essential Pre-Launch Features** 🟡 IMPORTANT

#### 4. Cast Editing Functionality ⭐ IMPORTANT

**Why**: Users will immediately want to fix typos or change timing.

**What to build**:
- New API route: `PUT /api/casts/edit`
  - Only allow editing `status='pending'` casts
  - Validate new content (≤320 chars)
  - Validate new scheduled_time (must be future)
  - Update `updated_at` timestamp
  - Return updated cast
- Add edit UI to Dashboard
  - Edit button next to each pending cast
  - Modal/inline form for editing
  - Preview before saving

**Request format**:
```json
{
  "cast_id": "uuid",
  "content": "New content",
  "scheduled_time": "2025-10-28T14:00:00Z"
}
```

**Business rules**:
- Cannot edit `status='sent'` or `status='cancelled'` casts
- Cannot edit if cast is currently being sent (edge case)
- Must validate same rules as schedule endpoint

**Files to create/modify**:
- `src/app/api/casts/edit/route.ts` - new endpoint
- `src/components/Dashboard.tsx` - edit UI
- `docs/API.md` - document edit endpoint
- `docs/FEATURES.md` - update business rules

**Success criteria**:
- Users can edit pending casts
- Validation prevents invalid edits
- UI clearly shows what can be edited

---

#### 5. Signer Expiry Handling

**Why**: Signers can expire or be revoked. Need graceful degradation.

**What to build**:
- Detect signer expiry errors in cron job
  - Parse Neynar error responses
  - Mark cast as `status='failed'` with `error_message='SIGNER_EXPIRED'`
  - Don't retry (no point retrying expired signer)
- Frontend notification system
  - Show banner if user has failed casts due to signer expiry
  - Provide "Re-approve Signer" button
  - Link to signer approval flow
- Optional: Periodic signer validation
  - Check signer status before scheduling
  - Warn user if signer is about to expire

**Files to modify**:
- `src/app/api/cron/send-casts/route.ts` - detect expiry
- `src/components/Dashboard.tsx` - expiry banner
- `src/components/AuthFlow.tsx` - re-approval flow
- `docs/FEATURES.md` - document signer lifecycle

**Success criteria**:
- Users get clear notification when signer expires
- Easy path to re-approve signer
- No confusion about why casts fail

---

#### 6. Payment Verification Improvements

**Why**: Better UX during payment flow, handle edge cases.

**What to build**:
- Better transaction confirmation feedback
  - Show pending state during 3-second verification
  - Show block explorer link
  - Clear success/failure messages
- Handle edge cases:
  - Transaction pending too long (> 30 seconds)
  - Wrong recipient address
  - Wrong amount
  - Network congestion (suggest retry)
- Add payment receipt view (optional)
  - Show transaction hash
  - Show payment date
  - Link to block explorer

**Files to modify**:
- `src/app/api/payments/record/route.ts` - better validation
- Payment UI component - better feedback
- `docs/API.md` - document edge cases

**Success criteria**:
- Users understand payment status at all times
- Edge cases handled gracefully
- Clear error messages for payment failures

---

### **Day 5: Testing & Polish** 🟢 QUALITY

#### 7. Manual Testing Checklist

**Why**: Catch bugs before users do.

**What to test**:

**Happy Path**:
- [ ] Open app in Warpcast
- [ ] FID detected correctly
- [ ] Create signer → approve in Warpcast
- [ ] Schedule a cast (future time)
- [ ] See cast in pending list
- [ ] Wait for scheduled time → cast publishes
- [ ] Verify cast appears on Farcaster
- [ ] Check user's `casts_used` incremented (free tier)
- [ ] Pay 10 USDC → plan upgraded to unlimited
- [ ] Schedule unlimited casts

**Error Scenarios**:
- [ ] Schedule cast without signer → proper error
- [ ] Schedule cast with past time → proper error
- [ ] Schedule cast with >320 chars → proper error
- [ ] Schedule 2nd cast as free user → blocked
- [ ] Cancel pending cast → removed from list
- [ ] Edit pending cast → changes saved
- [ ] Fail cast (simulate Neynar error) → retry logic works
- [ ] Expired signer → clear error message
- [ ] Payment with wrong amount → rejected
- [ ] Payment already recorded → prevented

**Edge Cases**:
- [ ] Schedule cast for 1 minute from now → publishes on time
- [ ] Schedule multiple casts at same time → all publish
- [ ] Delete user → cascades to casts and payments
- [ ] Cron runs with no pending casts → no errors
- [ ] Very long content (319 chars) → works
- [ ] Content at exactly 320 chars → works
- [ ] Content at 321 chars → rejected

**Cross-browser/Device**:
- [ ] Test in Warpcast iOS app
- [ ] Test in Warpcast Android app
- [ ] Test on desktop (if applicable)

**Files to create**:
- `docs/TESTING.md` - testing checklist and procedures

**Success criteria**:
- All happy path scenarios work
- All error scenarios handled gracefully
- No critical bugs found

---

#### 8. UI/UX Polish

**Why**: First impressions matter.

**What to polish**:
- **Loading states**:
  - Show spinner during signer creation
  - Show spinner during payment verification
  - Show spinner while scheduling cast
  - Disable buttons during loading
- **Error messages**:
  - Replace generic errors with specific messages
  - Use friendly language
  - Provide actionable next steps
- **Success confirmations**:
  - Toast/notification on cast scheduled
  - Confetti on payment success (optional)
  - Clear feedback for all actions
- **Empty states**:
  - Helpful message when no pending casts
  - Guide user to schedule first cast
  - Show sample cast (optional)
- **Micro-interactions**:
  - Button hover states
  - Smooth transitions
  - Form validation feedback

**Files to modify**:
- All component files in `src/components/`
- Add toast/notification library if needed
- `src/app/globals.css` - polish styles

**Success criteria**:
- App feels responsive and polished
- Users never confused about what's happening
- Clear feedback for every action

---

### **Day 6-7: Deployment & Launch Prep** 🚀 LAUNCH

#### 9. Vercel Deployment Setup

**Why**: Get the app live in production.

**Steps**:

1. **Prepare Vercel project**:
   ```bash
   npm run build  # verify build works
   npm run deploy:vercel  # or vercel --prod
   ```

2. **Configure environment variables** in Vercel dashboard:
   - Copy all from `.env.local`
   - Update `NEXT_PUBLIC_URL` to production domain
   - Update `NEXTAUTH_URL` to production domain
   - Generate new `CRON_SECRET` (use `openssl rand -hex 32`)
   - Verify `PAYMENT_RECEIVER_ADDRESS` is correct
   - Set `VERCEL_ENV=production`

3. **Set up Vercel Cron**:
   - Add to `vercel.json`:
     ```json
     {
       "crons": [{
         "path": "/api/cron/send-casts",
         "schedule": "*/1 * * * *"
       }]
     }
     ```
   - Verify cron is enabled in Vercel dashboard
   - Or use external cron service (cron-job.org, Upstash QStash)

4. **Database setup**:
   - Verify Supabase production instance is ready
   - Run migrations if needed
   - Test connection from Vercel

5. **Test in production**:
   - Open app in Warpcast
   - Run through complete user flow
   - Verify cron job runs (check Vercel logs)
   - Test payment flow with real transaction

**Files to modify**:
- `vercel.json` - add cron configuration
- `README.md` - update with production URL
- `docs/PROJECT_SETUP.md` - add deployment section

**Success criteria**:
- App accessible at production URL
- All environment variables configured
- Cron job running every 1-2 minutes
- Database connected
- Payment flow works in production

---

#### 10. Documentation & Launch Prep

**Why**: Users need to know how to use the app.

**What to create**:

1. **User Guide** (optional, can be in-app):
   - How to schedule a cast
   - How to upgrade to unlimited
   - How to cancel/edit casts
   - FAQ section

2. **Update existing docs**:
   - `README.md` - add production URL
   - `docs/LOGBOOK.md` - add launch entry
   - `docs/API.md` - verify all endpoints documented
   - This `ROADMAP.md` - mark Phase 1 complete

3. **Prepare launch materials**:
   - Draft launch cast for Farcaster
   - Screenshots/demo video (optional)
   - Prepare for user feedback

4. **Monitoring setup**:
   - Bookmark Vercel logs page
   - Set up log alerts (if available)
   - Prepare to monitor first users

**Files to update**:
- `README.md` - production URL, user guide link
- `docs/LOGBOOK.md` - launch entry
- Create `docs/USER_GUIDE.md` (optional)

**Success criteria**:
- Documentation reflects production state
- Launch materials ready
- Monitoring plan in place

---

## Phase 2: Post-Launch (Week 2-4)

**Goal**: Iterate based on user feedback, add nice-to-have features.

**Approach**: Don't build until users ask for it.

### Potential Features (prioritize based on feedback):

#### Cast Management Enhancements
- **Thread support**: Schedule a thread of connected casts
- **Cast templates**: Save common cast formats
- **Bulk operations**: Cancel/edit multiple casts at once
- **Draft casts**: Save drafts without scheduling
- **Queue management**: Auto-schedule from a queue

#### Scheduling Improvements
- **Recurring casts**: Daily/weekly schedules
- **Optimal scheduling**: Suggest best times to post
- **Timezone support**: Better timezone handling
- **Calendar view**: Visual calendar of scheduled casts

#### Analytics & Insights
- **Cast performance**: Track engagement after publishing
- **Best time to post**: Analyze when casts perform best
- **Scheduling stats**: Show user's scheduling patterns
- **Success rate**: Track sent vs failed casts

#### Monetization Enhancements
- **Tiered pricing**: Multiple plan levels
  - Free: 1 cast
  - Basic: $5 for 10 casts/month
  - Pro: $10 unlimited
- **Referral program**: Discount for referrals
- **Custom pricing**: Enterprise tier for brands

#### Technical Improvements
- **Distributed lock**: Prevent concurrent cron issues (use Upstash Redis)
- **Automated tests**: Unit + integration tests
- **Error tracking**: Sentry integration
- **Performance monitoring**: Track API response times
- **Database optimization**: Add indexes for slow queries

#### Platform Features
- **Media support**: Upload images with casts
- **Link previews**: Rich embeds
- **Mentions**: Auto-complete @mentions
- **Channel support**: Post to specific channels

---

## Phase 3: Growth & Scale (Month 2+)

**Goal**: Scale to thousands of users, optimize for growth.

### Infrastructure
- **Horizontal scaling**: Multiple cron workers with distributed lock
- **Caching layer**: Redis for user data and cast lists
- **CDN**: Static asset optimization
- **Database optimization**: Read replicas, connection pooling
- **Rate limiting**: Protect against abuse

### Business Features
- **Team accounts**: Multiple users per account
- **Approval workflows**: Draft → approve → schedule
- **Multi-user management**: Delegate scheduling
- **White-label**: Custom branding for enterprises
- **API access**: Let users integrate via API

### Platform Expansion (only if validated demand)
- **Multi-platform**: Twitter, Lens, etc. (requires significant effort)
- **Mobile app**: Native iOS/Android apps
- **Browser extension**: Schedule from anywhere
- **Zapier integration**: Connect to other tools

### Analytics & ML (future)
- **AI content suggestions**: Help write better casts
- **Engagement prediction**: Predict cast performance
- **Auto-optimization**: ML-optimized scheduling

---

## Technical Implementation Notes

### Retry Logic Implementation

**Approach**: Exponential backoff with max retries.

**Database changes**:
```sql
ALTER TABLE scheduled_casts
ADD COLUMN retry_count INTEGER DEFAULT 0,
ADD COLUMN last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN next_retry_at TIMESTAMP WITH TIME ZONE;
```

**Retry schedule**:
- Attempt 1: Immediate (on first failure)
- Attempt 2: +5 minutes
- Attempt 3: +15 minutes
- Attempt 4: +30 minutes (mark permanently failed)

**Cron query**:
```sql
SELECT * FROM scheduled_casts
WHERE (
  (status = 'pending' AND scheduled_time <= NOW())
  OR
  (status = 'failed' AND retry_count < 3 AND next_retry_at <= NOW())
)
ORDER BY scheduled_time ASC
LIMIT 50;
```

**Code structure**:
```typescript
import { backOff } from 'exponential-backoff';

async function publishCastWithRetry(cast: PendingCast) {
  try {
    await backOff(
      () => neynarClient.publishCast({...}),
      {
        numOfAttempts: 1, // We handle retries manually
        retry: (e, attemptNumber) => {
          // Only retry on network errors, not validation errors
          return isRetryableError(e);
        }
      }
    );

    // Success: mark as sent
    await updateCastStatus(cast.id, 'sent', { cast_hash, sent_at });

  } catch (error) {
    const retryCount = cast.retry_count + 1;

    if (retryCount >= 3 || !isRetryableError(error)) {
      // Permanently failed
      await updateCastStatus(cast.id, 'failed', {
        error_message,
        retry_count: retryCount
      });
    } else {
      // Schedule retry
      const nextRetryAt = calculateNextRetry(retryCount);
      await updateCastStatus(cast.id, 'failed', {
        error_message,
        retry_count: retryCount,
        last_retry_at: new Date(),
        next_retry_at: nextRetryAt
      });
    }
  }
}

function calculateNextRetry(retryCount: number): Date {
  const delays = [5 * 60, 15 * 60, 30 * 60]; // minutes to seconds
  const delaySeconds = delays[retryCount - 1] || 30 * 60;
  return new Date(Date.now() + delaySeconds * 1000);
}

function isRetryableError(error: any): boolean {
  // Network errors, timeouts, rate limits: retry
  // Validation errors, invalid signer: don't retry
  if (error.message?.includes('SIGNER_EXPIRED')) return false;
  if (error.message?.includes('INVALID_CONTENT')) return false;
  return true; // Default to retry
}
```

---

### Cast Editing Implementation

**API endpoint**: `PUT /api/casts/edit`

**Validation logic**:
```typescript
export async function PUT(req: NextRequest) {
  const { cast_id, content, scheduled_time } = await req.json();

  // Fetch existing cast
  const { data: cast } = await supabase
    .from('scheduled_casts')
    .select('*')
    .eq('id', cast_id)
    .single();

  if (!cast) {
    return NextResponse.json({ error: 'Cast not found' }, { status: 404 });
  }

  // Only allow editing pending casts
  if (cast.status !== 'pending') {
    return NextResponse.json(
      { error: 'Can only edit pending casts' },
      { status: 400 }
    );
  }

  // Validate new content
  if (content && content.length > 320) {
    return NextResponse.json(
      { error: 'Content too long (max 320 chars)' },
      { status: 400 }
    );
  }

  // Validate new scheduled_time (must be future)
  if (scheduled_time && new Date(scheduled_time) <= new Date()) {
    return NextResponse.json(
      { error: 'Scheduled time must be in the future' },
      { status: 400 }
    );
  }

  // Update cast
  const updates: any = { updated_at: new Date().toISOString() };
  if (content) updates.content = content;
  if (scheduled_time) updates.scheduled_time = scheduled_time;

  const { data: updated, error } = await supabase
    .from('scheduled_casts')
    .update(updates)
    .eq('id', cast_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update cast' }, { status: 500 });
  }

  return NextResponse.json({ success: true, cast: updated });
}
```

---

### Vercel Cron Configuration

**Option 1: Vercel Cron (Recommended)**

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-casts",
    "schedule": "*/1 * * * *"
  }]
}
```

**Schedule syntax**:
- `*/1 * * * *` = Every 1 minute
- `*/2 * * * *` = Every 2 minutes
- `*/5 * * * *` = Every 5 minutes

**Note**: Vercel Cron automatically includes authorization header, no need for CRON_SECRET check on Vercel-triggered requests.

**Option 2: External Cron Service**

If Vercel Cron isn't available or for redundancy:

1. **cron-job.org** (Free):
   - URL: `https://your-app.vercel.app/api/cron/send-casts`
   - Schedule: `*/1 * * * *`
   - Custom header: `Authorization: Bearer YOUR_CRON_SECRET`

2. **Upstash QStash** (Free tier available):
   ```bash
   npm install @upstash/qstash
   ```
   - Better reliability
   - Built-in retries
   - Request signing

3. **GitHub Actions** (Free):
   ```yaml
   name: Cron Job
   on:
     schedule:
       - cron: '*/1 * * * *'
   jobs:
     trigger:
       runs-on: ubuntu-latest
       steps:
         - name: Call API
           run: |
             curl -X GET "https://your-app.vercel.app/api/cron/send-casts" \
                  -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
   ```

---

## Success Metrics

### Week 1 (Launch)
- [ ] Zero critical bugs in production
- [ ] Cron job runs successfully every minute
- [ ] First 10 users schedule casts successfully
- [ ] At least 1 paid conversion
- [ ] All scheduled casts publish on time (>95% success rate)

### Week 2-4 (Early Traction)
- [ ] 100+ scheduled casts published
- [ ] 10+ paid users
- [ ] <5% failed cast rate (excluding user errors)
- [ ] Positive user feedback
- [ ] Feature requests collected

### Month 2+ (Growth)
- [ ] 1000+ scheduled casts
- [ ] 100+ paid users
- [ ] <2% failed cast rate
- [ ] Referral/word-of-mouth growth
- [ ] Clear product-market fit

### Technical Metrics (Ongoing)
- **Uptime**: >99.5%
- **API latency**: <500ms p95
- **Cron execution time**: <10s for 50 casts
- **Database query time**: <100ms p95
- **Failed cast rate**: <5% (excluding user errors)

---

## Risk Mitigation

### High-Risk Areas

1. **Cron Job Reliability**
   - **Risk**: Vercel/external cron fails, casts don't publish
   - **Mitigation**: Monitor cron health endpoint, set up alerts, have backup cron service
   - **Recovery**: Manual trigger endpoint for emergency

2. **Signer Expiry**
   - **Risk**: Many users' signers expire at once, mass failures
   - **Mitigation**: Clear error messages, easy re-approval flow
   - **Recovery**: Batch notification to affected users

3. **Payment Verification**
   - **Risk**: Blockchain delays cause payment verification to fail
   - **Mitigation**: 3-second delay, clear error messages, manual verification option
   - **Recovery**: Support endpoint to manually verify transactions

4. **Rate Limits**
   - **Risk**: Neynar/Farcaster rate limits hit, casts fail
   - **Mitigation**: Retry logic with backoff, batch requests, monitor usage
   - **Recovery**: Queue casts for later, notify users

5. **Database Performance**
   - **Risk**: Slow queries at scale
   - **Mitigation**: Proper indexes, query optimization, connection pooling
   - **Recovery**: Add read replicas, optimize queries

### Contingency Plans

**If cron fails**:
- Manual trigger: `POST /api/cron/send-casts` with Bearer token
- Switch to backup cron service
- Notify users of delay

**If payments fail**:
- Manual verification endpoint for support
- Refund process for failed payments
- Clear communication with users

**If Neynar is down**:
- Queue casts for later
- Display status banner to users
- Automatic retry when service recovers

---

## Notes

- Keep this roadmap updated as you progress
- Mark completed items with ✅
- Add new items to Phase 2/3 as feature requests come in
- Review and adjust priorities weekly based on user feedback
- Don't build features until users ask for them (except Phase 1 must-haves)

---

## Appendix: Development Commands

**Local development**:
```bash
npm run dev              # Start dev server
npm run build            # Test production build
npm run lint             # Check code quality
npx tsc --noEmit         # Check TypeScript
```

**Deployment**:
```bash
npm run deploy:vercel    # Deploy to Vercel
vercel --prod           # Alternative deploy
```

**Database**:
```bash
# Run migrations in Supabase SQL Editor:
# 1. Open Supabase dashboard
# 2. Go to SQL Editor
# 3. Run contents of db/schema.sql or supabase/schema.sql
```

**Testing**:
```bash
# Manual testing checklist in docs/TESTING.md (to be created)
```

---

**Last Updated**: 2025-10-27
**Next Review**: After launch (Day 7)
