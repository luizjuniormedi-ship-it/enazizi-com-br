/**
 * LANGUAGE LEAK HARDENING V3 — Regression Suite
 *
 * Espelha o regex canônico de `supabase/functions/tutor-v3-premium/index.ts`
 * (LANGUAGE_LEAK_PATTERN). Qualquer alteração no regex DEVE atualizar este
 * arquivo. O CI/CD falha se um PASS virar FAIL ou um FAIL virar PASS.
 *
 * ⚠️ MANTENHA SINCRONIZADO com tutor-v3-premium/index.ts
 */
import { describe, it, expect } from "vitest";

// === CANONICAL REGEX (sync with edge) ========================================
const LANGUAGE_LEAK_PATTERN =
  /[\u4e00-\u9fff]|\b(?:seg[uú]n|presentaci[oó]n|colelitiasis|watchful waiting|bile salts|enamed-style|readiness score)\b/i;

const isLeak = (text: string) => LANGUAGE_LEAK_PATTERN.test(text);

// === CASOS QUE DEVEM PASSAR (não são leak) ===================================
const MUST_PASS: Array<[string, string]> = [
  ["4Fs", "Mnemônico clássico dos 4Fs: Female, Forty, Fat, Fertile — útil em litíase biliar."],
  ["IAM siglas", "Diferenciar NSTEMI de STEMI segundo guideline AHA; considerar stent ou bypass."],
  ["Sepse escores", "Aplicar SOFA e qSOFA no screening precoce de sepsis grave."],
  ["Gastro cognatos", "Cholesterol elevado, pancreatitis aguda, hepatitis viral e gallstones."],
  ["Pesquisa científica", "Trial randomizado, endpoint primário, follow-up de 12 meses, meta-analysis."],
  ["Mnemônicos extras", "Escores CHA2DS2-VASc, CURB-65, Wells, PERC, FAST, ATLS, MONA, ABCDE."],
  ["Emergência", "Manejo de stroke, trauma e shock séptico conforme protocolo."],
];

// === CASOS QUE DEVEM FALHAR (leak real) ======================================
const MUST_FAIL: Array<[string, string]> = [
  ["Inglês exclusivo — bile salts", "The patient requires watchful waiting and bile salts therapy."],
  ["Inglês exclusivo — readiness", "Compute the readiness score before the exam."],
  ["Espanhol — según", "Según la presentación clínica del paciente, se procede."],
  ["Espanhol — colelitiasis", "Diagnóstico de colelitiasis sintomática crônica."],
  ["Marcador interno", "Use enamed-style formatting in all outputs."],
  ["CJK", "诊断为急性胆囊炎 paciente feminina."],
];

describe("LANGUAGE LEAK ENGINE v3 — Regression Suite", () => {
  describe("MUST PASS — terminologia médica legítima", () => {
    for (const [name, text] of MUST_PASS) {
      it(`aceita: ${name}`, () => {
        expect(isLeak(text)).toBe(false);
      });
    }
  });

  describe("MUST FAIL — vazamento de idioma real", () => {
    for (const [name, text] of MUST_FAIL) {
      it(`rejeita: ${name}`, () => {
        expect(isLeak(text)).toBe(true);
      });
    }
  });

  it("métricas: 0% falso-positivo na whitelist médica", () => {
    const fp = MUST_PASS.filter(([, t]) => isLeak(t)).length;
    expect(fp).toBe(0);
  });

  it("métricas: 100% bloqueio em leaks reais", () => {
    const fn = MUST_FAIL.filter(([, t]) => !isLeak(t)).length;
    expect(fn).toBe(0);
  });
});
