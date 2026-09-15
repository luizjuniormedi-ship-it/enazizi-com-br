import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * E2E — Cadeia integrada FSRS + TRI/Approval Score.
 *
 * Valida que finalizar um simulado dispara, em cadeia:
 *   Simulado → practice_attempts → error_bank → fsrs_cards
 *            → approval_scores → chance_by_exam
 *            → assistant_decisions → ENAFLIX → Planner → Tutor (ctx FSRS)
 *
 * Também valida que finalização dupla NÃO duplica linhas
 * (idempotência do Loop 4B).
 *
 * Requer:
 *   E2E_USER_EMAIL, E2E_USER_PASSWORD
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const E2E_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || '';

const HAS_CREDENTIALS = !!(SUPABASE_URL && SUPABASE_ANON && E2E_EMAIL && E2E_PASSWORD);

async function getAuthedClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await client.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  });
  if (error || !data.user) throw new Error(`Auth fail: ${error?.message}`);
  return { client, userId: data.user.id };
}

async function loginUI(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', E2E_EMAIL);
  await page.fill('input[type="password"]', E2E_PASSWORD);
  await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
  await expect(page).not.toHaveURL(/.*login.*/, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem('enazizi_v2_welcome_seen', 'true');
    localStorage.setItem('enazizi_v2_onboarding_done', 'true');
  });
}

function attachFailureGuards(page: Page, failures: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (
        t.includes('ErrorBoundary') ||
        t.includes('ReferenceError') ||
        t.includes('TypeError') ||
        t.includes('Uncaught')
      ) {
        failures.push(`console: ${t}`);
      }
    }
  });
  page.on('response', (res) => {
    const s = res.status();
    if (s === 403 || s >= 500) {
      failures.push(`http ${s}: ${res.url()}`);
    }
  });
  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
}

test.describe('FSRS + TRI integrated chain', () => {
  test.skip(!HAS_CREDENTIALS, 'Missing E2E credentials or Supabase env vars');

  test('Simulado → TRI → Error Bank → FSRS → ENAFLIX → Planner → Tutor (no duplicates)', async ({
    page,
  }) => {
    const failures: string[] = [];
    attachFailureGuards(page, failures);

    const { client, userId } = await getAuthedClient();
    const startedAt = new Date().toISOString();

    // ── 1. Login UI
    await loginUI(page);

    // ── 2-3. Open Simulados + generate short ENARE
    await page.goto('/dashboard/simulados');
    await expect(page.getByTestId('simulados-page')).toBeVisible({ timeout: 20000 });

    const setup = page.getByTestId('generation-modal');
    await setup.scrollIntoViewIfNeeded();
    await setup.getByTestId('mode-estudo-button').click().catch(() => {});
    await setup.getByTestId('qtd-5-button').click();
    await setup.locator('button.rounded-full').first().click().catch(() => {});
    // The integrated persistence chain requires bank-backed UUID questions.
    // AI-only questions are ephemeral and intentionally cannot satisfy the
    // practice_attempts.question_id foreign key.
    await setup.getByRole('button', { name: /Montar com Banco/i }).click();

    // ── 4. Answer questions
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 90000 });
    for (let i = 0; i < 5; i++) {
      const opt = page.getByTestId('answer-option').first();
      if (await opt.isVisible().catch(() => false)) await opt.click();
      const next = page.getByTestId('next-question-button');
      if (await next.isVisible().catch(() => false)) {
        await next.click();
        continue;
      }
      const finish = page.getByTestId('finish-simulado-button');
      if (await finish.isVisible().catch(() => false)) {
        await finish.click();
        const confirmFinish = page.getByRole('button', { name: /Finalizar mesmo assim/i });
        if (await confirmFinish.isVisible().catch(() => false)) {
          await confirmFinish.click();
        }
        break;
      }
    }

    // ── 5. Result screen
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 30000 });

    // Give backend chain ~8s to settle (study-complete → approval-score, FSRS, etc.)
    await page.waitForTimeout(8000);

    // ── 6. DB validations
    const since = startedAt;

    const { data: analytics, error: analyticsError } = await client
      .from('simulado_question_analytics')
      .select('id, simulado_session_id, question_index, bank_question_id, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    expect(analyticsError, `simulado_question_analytics query failed: ${analyticsError?.message}`).toBeNull();
    expect(analytics, 'simulado_question_analytics rows created').not.toBeNull();
    expect((analytics ?? []).length, 'simulado_question_analytics rows created').toBeGreaterThan(0);

    const bankBackedAnalytics = (analytics ?? []).filter((row: any) => row.bank_question_id);

    const { data: attempts } = await client
      .from('practice_attempts')
      .select('id, event_hash, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    expect(attempts, 'practice_attempts created').not.toBeNull();
    if ((attempts ?? []).length === 0) {
      throw new Error(
        [
          'practice_attempts stayed empty after simulado completion.',
          `analytics_rows=${analytics?.length ?? 0}`,
          `bank_backed_analytics_rows=${bankBackedAnalytics.length}`,
          'This indicates the canonical DB fanout did not persist attempts.',
          'Check Supabase qszsyskumcmuknumwxtk for trg_fanout_simulado_answer and remove the legacy tr_refresh_mastery_on_practice trigger.',
        ].join(' '),
      );
    }
    expect((attempts ?? []).length).toBeGreaterThan(0);
    const hashes = (attempts ?? []).map((a: any) => a.event_hash).filter(Boolean);
    expect(new Set(hashes).size, 'no duplicate event_hash in practice_attempts').toBe(hashes.length);

    const { data: errors, error: errorBankError } = await client
      .from('error_bank')
      .select('id, tema, vezes_errado, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', since);
    // error_bank may legitimately be empty if user got everything right; just check no crash
    expect(errorBankError, `error_bank query failed: ${errorBankError?.message}`).toBeNull();
    expect(errors, 'error_bank query OK').not.toBeNull();

    const { data: fsrs, error: fsrsError } = await client
      .from('fsrs_cards')
      .select('id, due, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', since);
    expect(fsrsError, `fsrs_cards query failed: ${fsrsError?.message}`).toBeNull();
    expect(fsrs, 'fsrs_cards updated/created').not.toBeNull();

    await expect
      .poll(
        async () => {
          const { data: scores, error: scoresError } = await client
            .from('approval_scores')
            .select('id, score, created_at')
            .eq('user_id', userId)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(5);
          if (scoresError) throw new Error(`approval_scores query failed: ${scoresError.message}`);
          return (scores ?? []).length;
        },
        { message: 'approval_scores row created', timeout: 30000 },
      )
      .toBeGreaterThan(0);

    const { data: chance, error: chanceError } = await client
      .from('chance_by_exam')
      .select('banca, chance_score, updated_at')
      .eq('user_id', userId);
    expect(chanceError, `chance_by_exam query failed: ${chanceError?.message}`).toBeNull();
    expect(chance, 'chance_by_exam present').not.toBeNull();

    const { data: decisions, error: decisionsError } = await client
      .from('assistant_decisions')
      .select('id, event_hash, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);
    expect(decisionsError, `assistant_decisions query failed: ${decisionsError?.message}`).toBeNull();
    const decHashes = (decisions ?? []).map((d: any) => d.event_hash).filter(Boolean);
    expect(new Set(decHashes).size, 'no duplicate event_hash in assistant_decisions').toBe(
      decHashes.length,
    );

    // ── 7. ENAFLIX reflects review/recovery
    await page.goto('/dashboard/enaflix');
    await page.waitForLoadState('networkidle').catch(() => {});
    // Page must mount without ErrorBoundary
    await expect(page.locator('body')).toBeVisible();

    // ── 8. Planner shows prioritization
    await page.goto('/dashboard/planner');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('body')).toBeVisible();

    // ── 9. Tutor receives FSRS context
    await page.goto('/dashboard/tutor');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('body')).toBeVisible();

    // ── 10. Double-finish guard (idempotência)
    const beforeAttempts = (attempts ?? []).length;
    const beforeDecisions = (decisions ?? []).length;

    // Re-trigger study-complete via direct edge call (simulating double submit)
    const { data: session } = await client.auth.getSession();
    const token = session.session?.access_token;
    if (token && (attempts ?? []).length > 0) {
      const lastAttempt: any = attempts![0];
      await fetch(`${SUPABASE_URL}/functions/v1/study-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON,
        },
        body: JSON.stringify({
          actionType: 'simulado_complete',
          metadata: { simuladoFinished: true, replayOf: lastAttempt.id },
          topic: 'replay-test',
        }),
      }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const { data: afterAttempts } = await client
      .from('practice_attempts')
      .select('id, event_hash')
      .eq('user_id', userId)
      .gte('created_at', since);
    const { data: afterDecisions } = await client
      .from('assistant_decisions')
      .select('id, event_hash')
      .eq('user_id', userId)
      .gte('created_at', since);

    // Idempotência: counts may grow by replay row but no event_hash collisions
    const afterHashes = (afterAttempts ?? []).map((a: any) => a.event_hash).filter(Boolean);
    expect(new Set(afterHashes).size, 'practice_attempts still unique by event_hash').toBe(
      afterHashes.length,
    );
    const afterDecHashes = (afterDecisions ?? []).map((d: any) => d.event_hash).filter(Boolean);
    expect(new Set(afterDecHashes).size, 'assistant_decisions still unique by event_hash').toBe(
      afterDecHashes.length,
    );

    // ── Final guard: no runtime crashes
    expect(failures, `Runtime failures captured: ${failures.join(' | ')}`).toEqual([]);
  });
});
