# Allign — Claude Code Rules

## Supabase Client Usage

| Context | Import | Call |
|---|---|---|
| Server Component, Route Handler, Server Action | `lib/supabase/server.ts` | `const supabase = await createClient()` |
| Client Component | `lib/supabase/client.ts` | `const supabase = createClient()` |

## Never
- `import { createClient } from '@supabase/supabase-js'` directly
- `supabase.auth.getSession()` in any server context
- `createClient()` without `await` in server contexts

## Auth
- Always use `getUser()` — never `getSession()` in server contexts
- Protected routes: `/training`, `/dashboard`, `/performance`, `/reporting`
- Auth-only routes: `/login`, `/signup`

## Schema — Key Tables
- `organisations` (not academies) — root table
- `members` (not coaches) — staff, linked to orgs via `organisation_members`
- `organisation_members` — junction with `role` (`owner` / `head_coach` / `coach` / `analyst` / `admin`)
- `players` — linked via `home_organisation_id` (not `organisation_id`)
- `sessions` — linked to `organisation_id`
- `exercises` — linked to `organisation_id` (or `is_global = true`)
- `matches` — linked to `organisation_id`
- `match_events` — raw VEI layer
- `player_match_vei` — computed VEI layer
- `vei_reports` — certified reporting layer

## Key Pattern — Get current user's organisation
```ts
const { data: member } = await supabase
  .from('members')
  .select('id')
  .eq('user_id', user.id)
  .single()

const { data: orgMembership } = await supabase
  .from('organisation_members')
  .select('organisation_id, role')
  .eq('member_id', member.id)
  .single()

const organisationId = orgMembership.organisation_id
```

## Database
- The `"order"` column in `session_exercises` must always be quoted: `.select('"order"')`
- `absence_reason` is optional — `attended = false` with `absence_reason = null` is valid
- Members see all sessions at their organisation — filter by `organisation_id`, not `coach_ids`
- Never use `academy_id` — the column is now `organisation_id` everywhere
- Never query the `coaches` table — use `members` + `organisation_members`

## Design System
- Background: `#FFFFFF`
- Text primary: `#111111`
- Text secondary: `#6B7280`
- Muted labels: `#9CA3AF` (uppercase, small caps)
- Border: `1px solid #E5E7EB`
- Card border radius: `10px`
- Card padding: `24px`
- Font: `Inter`
- Black pills: `#111111` background, white text, `9999px` border radius
- Black buttons: `#111111` background, white text, `8px` border radius
- Active tab: solid black bottom border, no background fill
- Stats block: `#111111` background, white text

## Proxy (Next.js 16 — formerly Middleware)
- File: `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`)
- Exported function must be named `proxy`, not `middleware`

### Current matcher (no public/ assets yet)
```
/((?!_next/static|_next/image|favicon\.ico).*)
```

### Extended matcher (when public/ assets are added)
```
/((?!_next/static|_next/image|favicon\.ico|.*\.(?:svg|png|jpg|jpeg|webp|woff2?)$).*)
```

## ⚠️ IMPORTANT — RLS Disabled (Pre-Launch TODO)

The following tables have RLS temporarily disabled during development.
RLS MUST be re-enabled and policies tested before any live client goes on the platform.

### Tables with RLS disabled:
- `players` — disabled due to `auth.uid()` not resolving correctly with ECC JWT key
- `exercises` — disabled for same reason

### The root cause:
The Supabase project uses ECC (P-256) JWT signing keys. The `auth.uid()` function
in RLS policies does not resolve correctly when called from the browser client
using the legacy HS256 anon key.

### Fix before launch:
1. Migrate fully to the new publishable key format (`sb_publishable_...`)
2. Update `@supabase/ssr` to latest version to support new key format
3. Re-enable RLS on all disabled tables
4. Test every policy from the browser client — not just SQL editor
5. Verify `auth.uid()` resolves correctly in all policy contexts

### All other tables still have RLS enabled:
- `organisations`, `members`, `organisation_members`
- `sessions`, `session_players`, `session_exercises`, `session_footage`
- `matches`, `match_events`, `match_lineups`, `player_match_vei`
- `vei_reports`, `vei_report_matches`
- `match_events_staging`

## Key Rules Summary
- `createClient()` is `async` in server contexts — always `await` it
- `getUser()` makes a server-side network call and detects revoked tokens — use it everywhere auth matters
- `getSession()` only reads the local cookie — never use it for access decisions
- To protect a new route: add it to `protectedPaths` in `src/proxy.ts`
- To add a new auth-only route: add it to `authPaths` in `src/proxy.ts`
