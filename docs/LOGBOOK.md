# Dev Logbook

All significant changes, decisions, and issues are tracked here.

---

## 2025-10-27 - Comprehensive Documentation Sync

**Action**: Complete documentation audit and synchronization with current codebase

**Scope**:
- Scanned 20 API routes across auth, casts, payments, users, cron, and utilities
- Analyzed 3 database tables (users, scheduled_casts, payments) with full schema
- Verified 25+ React components and lib modules
- Mapped all environment variables (16 required, 7 optional)
- Cross-referenced package.json dependencies (43 dependencies, 11 devDependencies)

**Files Updated**:
- `docs/API.md`: Added 8 missing auth routes (nonce, validate, get-fid, signer, signers, session-signers, signed_key, send-notification), improved webhook and best-friends documentation
- `docs/DATA_MODEL.md`: Fixed schema file references (added both db/schema.sql and supabase/schema.sql)
- `docs/LLM.md`: Created comprehensive LLM context guide from scratch with stack versions, project status, code patterns, workflows, and architecture decisions
- `README.md`: Complete rewrite with modern structure, accurate tech stack, project structure tree, deployment instructions, and documentation links
- `docs/LOGBOOK.md`: This entry

**Key Findings**:
1. **API Routes**: 20 total routes documented
   - Auth: 10 routes (create-signer, signer-status, nonce, validate, get-fid, signer, signers, session-signers, signed_key, [...nextauth])
   - Casts: 3 routes (schedule, list, cancel)
   - Payments: 1 route (record)
   - Users: 2 routes (bulk fetch, individual)
   - Cron: 1 route (send-casts)
   - Other: 3 routes (best-friends, webhook, send-notification)

2. **Database**: 3 tables fully documented
   - users (12 columns, 1 index, 1 trigger)
   - scheduled_casts (11 columns, 3 indexes, 1 trigger)
   - payments (9 columns, 2 indexes)
   - Functions: increment_casts_used(), update_updated_at_column()

3. **Environment Variables**: 23 total (16 required, 7 optional)
   - Server-side validated via Zod in src/lib/env.server.ts
   - Public-side validated via Zod in src/lib/env.public.ts
   - All variables documented in .env.example

4. **Tech Stack Versions**:
   - Next.js: ^15 (App Router)
   - React: ^19
   - TypeScript: ^5
   - Neynar SDK: ^2.19.0
   - Supabase: ^2.39.0
   - Wagmi: ^2.14.12
   - Viem: ^2.23.6

5. **Project Structure**: Verified all directories match documentation
   - src/app/api/** (20 route files)
   - src/components/** (24 components)
   - src/lib/** (env validation, supabase, neynar, constants)
   - db/ (simple schema.sql)
   - supabase/ (full dump schema.sql)
   - docs/ (6 documentation files)
   - scripts/ (dev.js, deploy.ts, cleanup.js)

**Architecture Notes**:
- Service-role key used for all API routes (bypasses RLS)
- Authorization enforced in API layer via FID matching
- Casts_used counter is additive-only (prevents race conditions)
- 3-second delay in payment verification for L2 propagation
- No concurrent cron protection (documented as known issue)
- Race condition in free tier limit (checked at schedule time, not send time)

**Warnings/TODOs**:
- ⚠️ Concurrent cron runs could duplicate publishes (need distributed lock)
- ⚠️ Free tier race condition allows exceeding limit temporarily
- ⚠️ No retry logic for failed casts (must be manually rescheduled)
- ⚠️ Signer expiry not handled (assumes perpetual validity)

**Stats**:
- Items added: 8 API routes, 1 complete LLM.md file, comprehensive README.md
- Items updated: API.md (+200 lines), DATA_MODEL.md (schema refs), LLM.md (new), README.md (complete rewrite)
- TODOs created: 0 (documented known issues instead)
- Documentation coverage: 100% of implemented features

**Impact**:
- Documentation now accurately reflects production codebase (2025-10-27)
- LLM agents have comprehensive context for development
- New developers have clear onboarding path via README → docs/
- All API routes, database schema, and business rules documented
- Environment setup fully documented with validation

---

## 2025-10-21

### Documentation Refresh
- **Action**: Comprehensive documentation update across all 4 core files
- **Scope**:
  - Scanned 20+ API routes, 3 DB tables, 25+ components, lib modules
  - Verified all schema details from [db/schema.sql](../db/schema.sql)
  - Mapped complete route structure and business logic flows
- **Changes**:
  - **PROJECT_SETUP.md**: Added cron setup details, USDC contract address, clarified env validation
  - **DATA_MODEL.md**: Resolved TODOs, confirmed all indexes exist, added invariants summary
  - **API.md**: Added missing routes (best-friends, webhook, opengraph-image), improved examples
  - **FEATURES.md**: Added concurrent scheduling race condition note, expanded testing scenarios
- **Key Findings**:
  - Free tier counter is **additive only** (never decrements)
  - Counter increments on **send**, not schedule (important distinction)
  - 3-second delay in payment verification for blockchain sync
  - RLS policies are permissive (authorization in API layer via service-role key)
  - Cron has no distributed lock (concurrent runs could cause duplicates)
  - Race condition exists: free users can schedule multiple casts before limit enforced at send time

### Initial Bootstrap (earlier today)
- **Action**: Created lean documentation system with 4 core files
- **Purpose**: Enable fast LLM-assisted development and onboarding
- **Format**: Bullet points, code examples, <200 lines per file (now expanded with refresh)

---

## Template for Future Entries

```markdown
## YYYY-MM-DD

### [Feature/Fix/Change Name]
- **Action**: What was done
- **Reason**: Why it was done
- **Files changed**: List of modified files
- **Impact**: What changed for users/developers
- **Notes**: Any gotchas or follow-up needed

### Issues Encountered
- **Problem**: Description
- **Solution**: How it was resolved
- **Prevention**: How to avoid in future
```

---

## Notes

- Keep entries concise (3-5 bullets per item)
- Link to code when relevant: `[file.ts](../path/to/file.ts)`
- Tag entries: `fix`, `feature`, `refactor`, `docs`, `deploy`
- Use ISO dates (YYYY-MM-DD) for consistency
- Archive old entries after 6 months (move to `LOGBOOK_ARCHIVE.md`)
