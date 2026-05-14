I will execute a comprehensive audit and controlled consolidation of ENAZIZI to finalize the Enterprise MVP.

### FASE 1 & 2: Real Audit & Gap Identification
Based on my exploration:
- **Core Status**: The system is architecturally solid but suffers from "over-engineering entropy" with dozens of specialized edge functions and duplicate dashboard components.
- **Redundancies**: Multiple "Heroes" and "Dashboards" exist. `UnifiedMissionHero` and `EnaflixLayout` are the modern standard, while legacy layouts still haunt some routes.
- **Gaps**:
    - **Unified Loading**: `App.tsx` has a `PageLoader`, but hydration in `Dashboard.tsx` still feels fragmented (multiple hooks fetching overlapping data).
    - **Planner PDF**: Infrastructure exists, but the "deduplication" and "FSRS integration" in the UI need stabilization.
    - **Study Session**: The transition between `OperationalHub` and active study mode needs to be seamless and guaranteed to have a `decisionId`.
    - **FSRS**: Integrated in Flashcards and Study Session, but missing a global "Readiness" view in the MVP.

### FASE 3: Controlled Cleanup
- **Remove Orphaned Functions**: I will identify and list edge functions that are no longer used by the frontend (e.g., legacy `generate-lesson-from-real-study` vs `study-session`).
- **Consolidate Dashboard**: Ensure `Dashboard.tsx` uses only `useDashboardData` and `useStudyNext` for hydration.

### FASE 4: MVP Implementation/Refinement

#### 1. Unified Dashboard Hydration
- Optimize `useDashboardData.ts` to fully rely on the `get_unified_dashboard_data` RPC.
- Implement a single skeleton state in `Dashboard.tsx`.

#### 2. Planner & PDF Extract
- Enhance `SmartPlanner.tsx` to ensure the PDF topic extraction correctly populates the FSRS baseline.

#### 3. Missão do Dia
- Refine the recommendation engine in `study-next` edge function to prioritize Error Bank and FSRS Due.

#### 4. Study Session UX
- Improve mobile rendering for MCQ and ensure "Expert Explanation" always triggers Active Recall prompts.
- Force `decisionId` mandatory for all study steps.

#### 5. Question Bank Quality
- Enforce the 4-alternative standard via the `question-generator` system prompt.
- Stabilize the "Quality Lock" lifecycle (Draft -> Approved).

### FASE 5 & 6: Performance & Governance
- Optimize SQL indexes on `practice_attempts` and `fsrs_cards` to keep Dashboard < 1s.
- Lock the `Unified Telemetry` to sample only 10% of non-critical events (already partially done, will finalize).

### FASE 7: Final UX
- Standardize all cards to the "Pixar/Netflix" medical glassmorphism style.
- Remove redundant navigation links in the Sidebar.

---

### Technical Details
- **Unified RPC**: Update `get_unified_dashboard_data` to include missing metrics like `avg_retention` and `daily_streak` to eliminate secondary fetches.
- **Sampling Strategy**: Sample `telemetry_events` in `_shared/unified-core.ts` to prevent DB bloat.
- **Route Guard**: Ensure `ModuleGuard` is used consistently in `App.tsx`.
