# Dev Logbook

All significant changes, decisions, and issues are tracked here.

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
