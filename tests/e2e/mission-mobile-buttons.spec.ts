/**
 * Missão de Estudo — blindagem mobile.
 *
 * Garante que o padrão de bug "botão visualmente ativo mas sem clique real"
 * (overlay invisível, pointer-events-none, disabled indevido, safe-area
 * invadida) NÃO volte para a tela /dashboard/sessao-estudo.
 *
 * Pré-requisito: sessão autenticada na preview (cookies já presentes).
 */
import { test, expect, type Page } from "@playwright/test";

const ROUTE = "/dashboard/sessao-estudo";
const IPHONE_13 = { width: 390, height: 844 };

const CARDS = [
  { name: /Minhas Revisões/i, expectedPath: /\/dashboard\/sessao-estudo\?focus=reviews/ },
  { name: /Banco de Erros/i, expectedPath: /\/dashboard\/banco-erros/ },
  { name: /Simulados/i, expectedPath: /\/dashboard\/simulados/ },
  { name: /Tutor Mentor/i, expectedPath: /\/dashboard\/chatgpt/ },
];

async function gotoMission(page: Page) {
  await page.setViewportSize(IPHONE_13);
  await page.goto(ROUTE);
  // OperationalHub renders quando NÃO há tópico/foco/auto na URL
  await expect(page.getByRole("heading", { name: /Sua missão começa aqui/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Missão de Estudo — mobile (iPhone 13)", () => {
  test("header respeita safe-area do iPhone (não fica sob status bar)", async ({ page }) => {
    await gotoMission(page);
    const scroller = page.locator('div.flex-1.overflow-y-auto').first();
    const padTop = await scroller.evaluate((el) => getComputedStyle(el).paddingTop);
    // env(safe-area-inset-top) + 12px → mínimo 12px em ambiente sem notch
    expect(parseFloat(padTop)).toBeGreaterThanOrEqual(12);
  });

  test('"Iniciar Sessão" sem tema mostra toast de validação', async ({ page }) => {
    await gotoMission(page);
    const input = page.getByPlaceholder(/Insuficiência Cardíaca/i);
    await input.fill("");
    await page.getByRole("button", { name: /Iniciar Sessão/i }).click();
    await expect(
      page.getByText(/Escolha ou digite um tema para iniciar/i),
    ).toBeVisible({ timeout: 5_000 });
    // Não deve ter navegado
    await expect(page).toHaveURL(new RegExp(ROUTE));
  });

  test("chip AVC preenche input, marca aria-pressed e permite iniciar", async ({ page }) => {
    await gotoMission(page);
    const chip = page.getByRole("button", { name: "AVC", exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByPlaceholder(/Insuficiência Cardíaca/i)).toHaveValue("AVC");

    // Iniciar dispara navegação para fluxo de sessão (URL muda saindo do hub)
    await page.getByRole("button", { name: /Iniciar Sessão/i }).click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/dashboard/sessao-estudo") &&
        (url.search.includes("topic=") ||
          url.search.includes("auto=") ||
          url.search.includes("focus=")),
      { timeout: 10_000 },
    ).catch(async () => {
      // fallback: o hub pode mudar de step interno sem mudar a URL
      const hub = page.getByRole("heading", { name: /Sua missão começa aqui/i });
      await expect(hub).toBeHidden({ timeout: 5_000 });
    });
  });

  for (const card of CARDS) {
    test(`card "${card.name}" navega para rota real (não só telemetria)`, async ({ page }) => {
      await gotoMission(page);
      const target = page.getByRole("button", { name: card.name }).first();
      await expect(target).toBeVisible();
      // Confirma que NÃO está disabled nem coberto
      await expect(target).toBeEnabled();
      await target.click();
      await page.waitForURL(card.expectedPath, { timeout: 10_000 });
    });
  }
});

test.describe("Missão de Estudo — regressão de bloqueios invisíveis", () => {
  test("nenhum elemento com pointer-events-none cobre botões/inputs/cards", async ({ page }) => {
    await gotoMission(page);

    const interactiveSelectors = [
      'button:has-text("Iniciar Sessão")',
      'button[aria-pressed]',                  // chips
      'input[placeholder*="Insuficiência"]',
    ];

    for (const sel of interactiveSelectors) {
      const handles = await page.locator(sel).elementHandles();
      for (const h of handles) {
        const blocked = await h.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const top = document.elementFromPoint(cx, cy);
          if (!top) return false;
          // sobe a árvore — se o elemento topo (ou seu pai) for outro com
          // pointer-events:none, está coberto sem ser clique-seguro
          return !el.contains(top) && !top.contains(el as Node);
        });
        expect(blocked, `Elemento "${sel}" coberto por overlay`).toBe(false);
      }
    }
  });

  test("CTA principal nunca renderiza com atributo disabled", async ({ page }) => {
    await gotoMission(page);
    const cta = page.getByRole("button", { name: /Iniciar Sessão/i });
    // Usamos aria-disabled (validação soft via toast) — disabled nativo é proibido aqui
    await expect(cta).not.toHaveAttribute("disabled", "");
  });

  test("nenhum banner/toast invade safe-area top do iPhone", async ({ page }) => {
    await gotoMission(page);
    const violators = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      const offenders: string[] = [];
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed") continue;
        const top = parseFloat(cs.top);
        if (Number.isNaN(top) || top > 4) continue;
        // Permitido se respeita safe-area via padding-top com env()
        const pt = el.style.paddingTop || cs.paddingTop;
        if (pt && pt.includes("env(") ) continue;
        if (parseFloat(pt) >= 20) continue;
        // Heurística: ignora elementos invisíveis (h=0 ou opacity=0)
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        if (cs.opacity === "0" || cs.visibility === "hidden") continue;
        offenders.push(el.tagName + "." + (el.className || "").toString().slice(0, 40));
      }
      return offenders;
    });
    expect(violators, `Elementos fixed top sem safe-area: ${violators.join(", ")}`).toEqual([]);
  });
});
