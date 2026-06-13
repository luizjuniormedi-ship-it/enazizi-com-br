import { describe, it, expect } from "vitest";
import {
  normalizeTutorQuestion,
  hasPersonalContext,
  shouldBypassMemory,
} from "../normalizeQuestion";

describe("normalizeTutorQuestion", () => {
  it("normaliza pergunta com acentos, pontuação e stopwords", () => {
    const out = normalizeTutorQuestion(
      "Me explica insuficiência cardíaca com tratamento?",
    );
    expect(out).toBe("insuficiencia cardiaca tratamento");
  });

  it("retorna string vazia para entrada inválida", () => {
    expect(normalizeTutorQuestion("")).toBe("");
    expect(normalizeTutorQuestion(null as unknown as string)).toBe("");
  });

  it("é estável entre variações de redação", () => {
    const a = normalizeTutorQuestion("Quero entender a fisiopatologia da sepse");
    const b = normalizeTutorQuestion("Fisiopatologia da sepse?");
    // ambos colapsam para algo iniciando com "fisiopatologia sepse"
    expect(a).toContain("fisiopatologia");
    expect(a).toContain("sepse");
    expect(b).toContain("fisiopatologia");
    expect(b).toContain("sepse");
  });
});

describe("hasPersonalContext", () => {
  it("detecta contexto de paciente", () => {
    expect(hasPersonalContext("meu paciente apresentou dor torácica")).toBe(true);
    expect(hasPersonalContext("vi um caso de TEP")).toBe(true);
  });

  it("ignora perguntas conceituais", () => {
    expect(hasPersonalContext("Explique fisiopatologia da sepse")).toBe(false);
  });
});

describe("shouldBypassMemory", () => {
  it("detecta pedido de reformulação", () => {
    expect(shouldBypassMemory("explique de outro jeito")).toBe(true);
    expect(shouldBypassMemory("quero algo mais profundo")).toBe(true);
  });

  it("detecta comandos de avanço da aula", () => {
    expect(shouldBypassMemory("Compreendido, pode prosseguir para o próximo bloco da aula.")).toBe(true);
    expect(shouldBypassMemory("Próximo bloco")).toBe(true);
  });

  it("retorna falso para perguntas comuns", () => {
    expect(shouldBypassMemory("o que é IAM")).toBe(false);
  });
});
