# generate-flashcards — Hardening Evidence (Wave 4)

**Status:** `GENERATE-FLASHCARDS CONTRACT GATE READY — FREEZE SAFE`
**Wave:** 4 (P0 — Critical Go-Live Blocker)
**Date:** 2026-06-14

## 1. Executive status

`generate-flashcards` is now protected by a freeze-safe public-contract
regression gate. No production code, prompts, FSRS logic, memory, schema,
RLS or frontend were changed.

## 2. Bugs found

None. The function already implements:

- `req.json().catch(() => ({}))` defensive parsing
- `requireAuth` with explicit 401 envelope
- Server-side `clampQuantity` (`FLASHCARD_MAX_QUANTITY`)
- Server-side daily limit (`checkDailyFlashcardLimit` → 429 controlled)
- Cache hit short-circuit (`flashcard_generation_cache`)
- `parseAiJson` for AI response parsing
- Centralized error handling via `enterpriseEdgeHandler`

## 3. Patches applied

**None.** Production code is unchanged.

## 4. Scenarios covered

13 scenarios in `__tests__/contract.test.ts` — see suite README.

## 5. Invariants protected

- No raw 500 with stack trace
- No `TypeError` / `Cannot read` / `.trim is not` / `.toLowerCase is not` leaks
- Response always controlled (envelope or error)
- Flashcard arrays, when returned, respect `front/back` (or equivalents)
- `clampQuantity` upper bound respected

## 6. Remaining risks

- Mode A (no token) cannot exercise full generation pipeline.
- Mode B requires `SUPABASE_CONTRACT_USER_JWT` configured in CI secrets.
- AI quality of flashcards is out of scope (governed by `applyQualityGate`
  and `FLASHCARD_MOTOR_PREMIUM`, untouched here).

## 7. Freeze confirmation

- prompts: unchanged
- FSRS: unchanged
- semantic memory: unchanged
- Bank Guard: unchanged
- frontend: unchanged
- schema / RLS: unchanged
- `generate-adaptive-simulado`: unchanged
- `question-generator`: unchanged
- `tutor-v3-premium`: unchanged

## 8. CI

- Workflow: `.github/workflows/generate-flashcards-contract.yml`
- Workflow name: `generate-flashcards Contract Gate`
- Status check: `Generate flashcards contract regression`

## 9. Final status

`GENERATE-FLASHCARDS CONTRACT GATE READY — FREEZE SAFE`
