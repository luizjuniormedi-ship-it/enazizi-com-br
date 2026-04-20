

# Performance + Force Update on Login

Goal: speed up first paint and post-login, cut redundant queries, lazy-load heavy admin/analytics blocks, and keep the existing version-bump force-refresh working without loops.

The force-update mechanism already exists (`APP_RELEASE` + `forceLoginRefresh` + `performHardAppReset`) and it works. We will not rebuild it — we will hardening it (single-fire guarantees, cleaner version comparison) and reduce the work that runs around it.

## What I'll change

### 1. Reduce query waste on login (biggest win)

- **`useCoreData`**: `refetchOnWindowFocus: true` → `false`. `staleTime: 60s` → `5min`. (Currently re-fires 12 Supabase queries every time the tab regains focus.)
- **`useDashboardData`**: same — `refetchOnWindowFocus: false`, `staleTime: 2min`. (Currently re-fires ~13 queries on every focus.)
- **`useStudyEngineImpact`**: already 5min — leave.
- **`useInterventionAnalytics`**: gate with `enabled: !!user` (currently runs even when logged out on landing) and bump `staleTime` to 5min.
- **`useInterventionObservability`**: add `enabled` flag (only run when admin panel is mounted) — already only used inside admin panel, but ensure the hook accepts an `enabled` param so it doesn't run on first render of the panel before the admin tab is opened.
- **`useJourneyRefresh` (loaded by every Dashboard view)**: stop calling `queryClient.clear()` on `SIGNED_IN`. The version-bump path already does a hard reset; clearing on every SIGNED_IN throws away the freshly-fetched core-data and forces a re-fetch storm right after login. Replace `clear()` with targeted `invalidateQueries` for the journey keys only.

### 2. Lazy-load heavy Dashboard blocks

In `src/pages/Dashboard.tsx`, switch these from eager to `lazy()` + `Suspense fallback={null}`:
- `AdvancedAnalyticsAccordion` (collapsed by default — perfect for lazy)
- `GuidedFlowLayer`
- `ProgressOverview`
- `AdaptiveMnemonicCard`
- `TutorContinueCard`

`MissionHeroAnimated` and `InterventionCard` stay eager (above the fold).

### 3. Lazy-load admin observability panels

In `src/pages/admin/ValidationDashboard.tsx`, lazy-load:
- `InterventionObservabilityPanel`
- `InterventionAnalyticsPanel`
- `AlertOrchestratorAnalytics`, `AlertConversionPanel`, `AlertCorrelationPanel`

These currently load on every admin route hit even before the user scrolls.

### 4. Memoize hot components

Wrap with `React.memo`:
- `MissionHeroAnimated` (re-renders on every Dashboard state change today)
- `InterventionCard`
- `DashboardTopBar`
- `ProgressOverview`

### 5. Force-update on login — hardening (no rebuild)

Current flow already works. Small reinforcements only:
- In `forceLoginRefresh`: add a per-tab guard ref so two concurrent `SIGNED_IN` events (web + visibility-change) can't both trigger the hard reset.
- In `main.tsx`: when `__login_refresh=1` is consumed, also clean URL **before** mounting (already done — verify and keep).
- Add a single console marker on hard-reset path so we can see it firing in production logs.

No new file, no new key, no version-bump on every render. Mechanism stays: `APP_RELEASE` constant change → next login clears caches once, sets `LOGIN_REFRESH_SIGNATURE_KEY`, reloads exactly once.

### 6. No changes to

- Engine logic (Study, Intervention, Alert Orchestrator) — frozen
- Auth flow / session lifecycle
- Routing
- PWA registration logic in `main.tsx` (already correct, with iframe/preview guards)
- Database / Supabase functions / RLS

## Files touched

| File | Change |
|---|---|
| `src/hooks/useCoreData.ts` | `staleTime` 5min, `refetchOnWindowFocus: false` |
| `src/hooks/useDashboardData.ts` | `staleTime` 2min, `refetchOnWindowFocus: false` |
| `src/hooks/useInterventionAnalytics.ts` | accept `userId`, gate with `enabled`, `staleTime` 5min |
| `src/hooks/useInterventionObservability.ts` | add optional `enabled` arg |
| `src/hooks/useJourneyRefresh.ts` | remove `queryClient.clear()`, keep targeted invalidations |
| `src/lib/force-login-refresh.ts` | add module-level in-flight guard |
| `src/pages/Dashboard.tsx` | lazy-load 5 blocks; memo wrap MissionHero/InterventionCard |
| `src/pages/admin/ValidationDashboard.tsx` | lazy-load 5 admin sub-panels |
| `src/components/dashboard-v2/MissionHeroAnimated.tsx` | wrap export in `React.memo` |
| `src/components/dashboard/InterventionCard.tsx` | wrap export in `React.memo` |
| `src/components/dashboard/DashboardTopBar.tsx` | wrap export in `React.memo` |
| `src/components/dashboard/ProgressOverview.tsx` | wrap export in `React.memo` |

No file deletions. No DB changes. No edge function changes.

## Loop-prevention guarantees (force update)

1. `LOGIN_REFRESH_SIGNATURE_KEY` in sessionStorage only lets one refresh per `(release × user × sign-in)` triple — same as today.
2. New module-level boolean in `force-login-refresh.ts` blocks re-entry inside the same JS realm.
3. Hard-reset preserves the signature so the post-reload boot recognizes it and skips the cycle (already implemented in `main.tsx`).
4. PWA service-worker register code already has `isPreviewHost` / `isInIframe` guards — left alone.

## Expected impact

- First post-login render: ~12 fewer Supabase calls re-firing on tab focus.
- `/dashboard` initial JS payload: drops 4 heavy components from the critical chunk (advanced accordion, guided flow layer, progress overview, tutor continue, mnemonic).
- `/admin/validation` first paint: only KPIs + skeletons until each sub-panel resolves.
- Force update: same UX as today, just safer against double-fire.

## Verification

- `npx tsc --noEmit` → 0 errors.
- Manual smoke: load `/`, log in, confirm dashboard renders without flicker, confirm only one `[ENAZIZI] Release:` log per page load.
- No DB or RLS changes → no migration needed.

