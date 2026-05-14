# ENAZIZI Go-Live & Operational Excellence Plan (v16)

The project has reached Enterprise MVP maturity. This phase focuses on hardening the student experience, ensuring operational stability, and preparing for real-world traffic.

## 1. Auth & Session Hardening
- Audit `useAuth.tsx` to ensure `forceLoginRefresh` correctly handles token expiration without infinite loops.
- Validate `ProtectedRoute` and `ModuleGuard` interaction to prevent flashing unauthorized states.
- Ensure `ResetPassword.tsx` correctly detects tokens from URL hashes across all browser engines.

## 2. First User Experience (FUX) & Onboarding
- Refine `Register.tsx` to handle "already registered" errors gracefully with clear CTAs.
- Enhance `Diagnostic.tsx` generation reliability using the existing contingency/fallback question system.
- Ensure `UnifiedMissionHero` provides a clear "First Mission" when new users have zero history.

## 3. UX Hardening & Mobile Excellence
- Review `EnaflixLayout` to ensure immersive modes (Study Session, Tutor) fully respect safe areas and keyboard overlap on iOS/Android.
- Validate `EnaflixMobileNav` z-index and backdrop-blur performance on mid-range devices.
- Audit all `Skeleton` states to ensure layout stability during data synchronization (cockpit diagnostic mode).

## 4. Student Retention & Resilience
- Hardent the `updateStreak` logic in `activityLogger.ts` to prevent data loss during offline study sessions.
- Verify `studyCompleteRetryQueue.ts` correctly flushes pending pedagogical signals after network reconnection.
- Ensure `ResumeSessionBanner` provides immediate continuity for interrupted sessions.

## 5. Production Observability
- Finalize the `AdminMonitoring.tsx` dashboard to include health metrics for:
    - Auth (success rate, session duration)
    - AI Tutor (latency, signal confidence)
    - Planner (generation time, task completion)
    - Content Ops (quarantine volume, audit backlog)

## 6. Performance Optimization
- Target `<1s` for `Dashboard.tsx` first-paint using existing `lazyWithRetry` and `Suspense` boundaries.
- Ensure `useStudyNext` query is prefetched or cached to hit the `<3s` recommendation target.
- Validate that `behaviroalTelemetry` ampling (10%) is active to protect database throughput.

## Technical Details
- **sampling**: telemetry ampling set to 10% for non-critical events.
- **boundaries**: Global `ErrorBoundary` used for crash recovery.
- **persistence**: Local-first sync for pedagogical signals via `localStorage` queue.
- **mobile**: Safe-area-bottom classes applied to all fixed navigation.
