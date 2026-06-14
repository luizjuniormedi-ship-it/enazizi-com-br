/**
 * TOPIC FIDELITY — Regression Suite (Sprint V1 / Fase 7)
 *
 * Garante que o resolver mantém comportamento estável:
 *  - temas granulares (IAM, TEP, Pré-eclâmpsia) NUNCA classificam como genéricos
 *  - especialidades amplas / sistemas SEMPRE classificam como genéricos
 *
 * Build do CI quebra se um PASS virar GENERIC ou um GENERIC virar PASS.
 */
import { describe, it, expect } from "vitest";
import { resolveTopicGranularity } from "../../supabase/functions/_shared/topic-fidelity/topic-resolver";

const MUST_BE_GRANULAR: Array<[string, string]> = [
  ["Hierárquico 3 níveis", "Clínica Médica > Cardiologia > IAM"],
  ["Hierárquico Pneumo", "Clínica Médica > Pneumologia > TEP"],
  ["Hierárquico GO", "GO > Pré-eclâmpsia"],
  ["Sistema + tema", "Cardiologia > IC"],
  ["Sigla direta IAM", "IAM"],
  ["Sigla direta TEP", "TEP"],
  ["Tema OBS", "Pré-eclâmpsia"],
  ["Insuficiência Cardíaca", "Insuficiência Cardíaca"],
  ["STEMI", "STEMI"],
  ["NSTEMI", "NSTEMI"],
  ["Sepse", "Sepse"],
  ["Litíase Biliar", "Litíase Biliar"],
];

const MUST_BE_GENERIC: Array<[string, string]> = [
  ["Especialidade ampla CM", "Clínica Médica"],
  ["Especialidade Cirurgia", "Cirurgia"],
  ["Especialidade Pediatria", "Pediatria"],
  ["Especialidade GO", "GO"],
  ["Sistema Cardiologia sozinho", "Cardiologia"],
  ["Sistema Pneumologia sozinho", "Pneumologia"],
  ["Sistema Infectologia sozinho", "Infectologia"],
];

describe("Topic Fidelity Resolver v1 — Regression Suite", () => {
  describe("MUST BE GRANULAR (level 3, isGranular=true)", () => {
    for (const [name, input] of MUST_BE_GRANULAR) {
      it(`granular: ${name} → "${input}"`, () => {
        const r = resolveTopicGranularity(input);
        expect(r.isGranular, `${input} deveria ser granular`).toBe(true);
        expect(r.isGeneric, `${input} não deveria ser genérico`).toBe(false);
        expect(r.level).toBe(3);
      });
    }
  });

  describe("MUST BE GENERIC (level 1-2, isGeneric=true)", () => {
    for (const [name, input] of MUST_BE_GENERIC) {
      it(`genérico: ${name} → "${input}"`, () => {
        const r = resolveTopicGranularity(input);
        expect(r.isGeneric, `${input} deveria ser genérico`).toBe(true);
        expect(r.isGranular, `${input} não deveria ser granular`).toBe(false);
        expect(r.level).toBeLessThanOrEqual(2);
      });
    }
  });

  it("sistema genérico oferece sugestões", () => {
    const r = resolveTopicGranularity("Cardiologia");
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions).toContain("IAM");
  });

  it("input vazio retorna level 0", () => {
    const r = resolveTopicGranularity("");
    expect(r.level).toBe(0);
    expect(r.matchedVia).toBe("empty");
  });

  it("tema desconhecido vira granular com confidence baixa (não genérico)", () => {
    const r = resolveTopicGranularity("Síndrome de Wiskott-Aldrich");
    expect(r.isGeneric).toBe(false);
    expect(r.confidence).toBeLessThan(0.8);
    expect(r.matchedVia).toBe("unknown");
  });

  it("métricas: 0% falso-positivo na lista de granulares", () => {
    const fp = MUST_BE_GRANULAR.filter(([, t]) => resolveTopicGranularity(t).isGeneric).length;
    expect(fp).toBe(0);
  });

  it("métricas: 100% bloqueio na lista de genéricos", () => {
    const fn = MUST_BE_GENERIC.filter(([, t]) => !resolveTopicGranularity(t).isGeneric).length;
    expect(fn).toBe(0);
  });
});
