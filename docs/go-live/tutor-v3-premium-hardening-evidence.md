# tutor-v3-premium — Hardening Evidence (Wave 3)

**Status:** `TUTOR-V3-PREMIUM CONTRACT GATE READY — FREEZE SAFE`
**Wave:** 3 (P0 — Critical Go-Live Blocker)
**Date:** 2026-06-14

## 1. Executive status

The `tutor-v3-premium` Edge Function is the pedagogical core of ENAZIZI. A
freeze-safe public-contract regression gate has been installed without any
modification to prompts, pedagogical logic, FSRS, semantic memory,
Event Bus, Planner, Error Bank, Bank Guard, schema or RLS.

## 2. Bugs found

None requiring a production patch. The function already implements
defensive parsing (`req.json().catch(() => ({}))`), explicit auth check,
healthcheck pre-flight and centralized error handling via
`enterpriseEdgeHandler`.

## 3. Patches applied

**None.** Production code is unchanged.

## 4. Scenarios covered

Public-contract battery (`__tests__/contract.test.ts`), 13 scenarios:

- OPTIONS/CORS
- Unauthenticated → 401/403
- Healthcheck without crash
- Empty body
- Malformed JSON
- Minimal valid payload (token)
- Empty `message` (token)
- Non-string `message` (token)
- Invalid `intent` (token)
- Invalid `currentBlock` (token)
- Invalid `sessionId` (token)
- Non-array `history` (token)
- Adversarial payload — no leak of `TypeError` / stack

## 5. Invariants protected

- No raw 500 with stack trace
- No `TypeError` / `Cannot read` / `.trim is not` / `.toLowerCase is not` leaks
- Response is always either a controlled error envelope or a tutor-shaped payload
- `lessonComplete` (when present) is boolean
- `currentBlock` (when present) is string
- No mutation of FSRS / memory / Error Bank on invalid payloads (no token
  produces a user-bound write path)

## 6. Remaining risks

- Full semantic correctness of pedagogical outputs is out of scope for this
  gate (covered by upstream LANGUAGE/QUALITY checks already in the function).
- Mode A (no token) cannot exercise tutor flows end-to-end; Mode B requires
  `SUPABASE_CONTRACT_USER_JWT` to be configured in CI.

## 7. Freeze confirmation

- prompts: unchanged
- pedagogical block logic: unchanged
- FSRS: unchanged
- semantic memory: unchanged
- Bank Guard: unchanged
- Event Bus / Planner / Error Bank: unchanged
- frontend: unchanged
- schema / RLS: unchanged
- `generate-adaptive-simulado`: unchanged
- `question-generator`: unchanged

## 8. CI

- Workflow: `.github/workflows/tutor-v3-premium-contract.yml`
- Workflow name: `tutor-v3-premium Contract Gate`
- Status check: `Tutor V3 Premium contract regression`

## 9. Final status

`TUTOR-V3-PREMIUM CONTRACT GATE READY — FREEZE SAFE`
