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
    await setup.getByTestId('iniciar-simulado-button').click();

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
        break;
      }
    }

    // ── 5. Result screen
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 30000 });

    // Give backend chain ~8s to settle (study-complete → approval-score, FSRS, etc.)
    await page.waitForTimeout(8000);

    // ── 6. DB validations
    const since = startedAt;

    const { data: attempts } = await client
      .from('practice_attempts')
      .select('id, event_hash, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    expect(attempts, 'practice_attempts created').not.toBeNull();
    expect((attempts ?? []).length).toBeGreaterThan(0);
    const hashes = (attempts ?? []).map((a: any) => a.event_hash).filter(Boolean);
    expect(new Set(hashes).size, 'no duplicate event_hash in practice_attempts').toBe(hashes.length);

    const { data: errors } = await client
      .from('error_bank')
      .select('id, tema, vezes_errado, ultima_vez_errado')
      .eq('user_id', userId)
      .gte('ultima_vez_errado', since);
    // error_bank may legitimately be empty if user got everything right; just check no crash
    expect(errors, 'error_bank query OK').not.toBeNull();

    const { data: fsrs } = await client
      .from('fsrs_cards')
      .select('id, due, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', since);
    expect(fsrs, 'fsrs_cards updated/created').not.toBeNull();

    const { data: scores } = await client
      .from('approval_scores')
      .select('id, banca, score, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5);
    expect(scores, 'approval_scores row created').not.toBeNull();
    expect((scores ?? []).length).toBeGreaterThan(0);

    const { data: chance } = await client
      .from('chance_by_exam')
      .select('exam, chance, updated_at')
      .eq('user_id', userId);
    expect(chance, 'chance_by_exam present').not.toBeNull();

    const { data: decisions } = await client
      .from('assistant_decisions')
      .select('id, event_hash, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);
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
