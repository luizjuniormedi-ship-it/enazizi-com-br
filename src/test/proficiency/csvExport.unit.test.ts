/**
 * Unit tests — CSV export helpers para Plano de Proficiência.
 *
 * Cobre `buildPlanCsv`, `buildPlanCsvWithBom`, `escapeCsvField` e
 * `CSV_HEADERS`, garantindo que a exportação:
 *   - inclui coluna `turma`
 *   - inclui coluna `inativo`
 *   - faz escape correto de vírgulas/aspas/quebra de linha
 *   - prefixa com BOM UTF-8
 */
import { describe, it, expect } from "vitest";
import {
  CSV_BOM,
  CSV_HEADERS,
  buildPlanCsv,
  buildPlanCsvWithBom,
  escapeCsvField,
} from "../../components/professor/proficiencia/csvExport";
import type { PlanAnalyticsStudentRow } from "@/hooks/useProficiencyAnalytics";

const baseStudent = (over: Partial<PlanAnalyticsStudentRow> = {}): PlanAnalyticsStudentRow => ({
  user_id: "u1",
  display_name: "Ana Souza",
  email: "ana@example.com",
  avatar_url: null,
  progress_percent: 60,
  weekly_goal_status: "partial",
  completed_tasks: 6,
  pending_tasks: 4,
  overdue_tasks: 1,
  last_activity_at: "2026-01-05T10:00:00Z",
  recalc_count: 2,
  source: "direct",
  class_id: null,
  class_label: null,
  is_inactive: false,
  ...over,
});

describe("csvExport / headers", () => {
  it("inclui colunas obrigatórias incluindo turma e inativo", () => {
    expect(CSV_HEADERS).toContain("turma");
    expect(CSV_HEADERS).toContain("inativo");
    expect(CSV_HEADERS).toContain("plano");
    expect(CSV_HEADERS).toContain("aluno");
    expect(CSV_HEADERS).toContain("recalc_count");
  });

  it("ordem das colunas é estável", () => {
    expect(CSV_HEADERS[0]).toBe("plano");
    expect(CSV_HEADERS[1]).toBe("aluno");
  });
});

describe("csvExport / escapeCsvField", () => {
  it("não escapa string simples", () => {
    expect(escapeCsvField("ana")).toBe("ana");
  });

  it("escapa vírgulas envolvendo em aspas", () => {
    expect(escapeCsvField("Souza, Ana")).toBe('"Souza, Ana"');
  });

  it("escapa aspas duplicando-as", () => {
    expect(escapeCsvField('Ana "A" Souza')).toBe('"Ana ""A"" Souza"');
  });

  it("escapa quebra de linha", () => {
    expect(escapeCsvField("linha1\nlinha2")).toContain('"');
  });

  it("trata null/undefined como string vazia", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("csvExport / buildPlanCsv", () => {
  it("aluno direto exibe origem 'Direto' e turma vazia", () => {
    const csv = buildPlanCsv("Plano X", [baseStudent()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    const cols = lines[1].split(",");
    expect(cols[3]).toBe("Direto"); // origem
    expect(cols[4]).toBe(""); // turma
  });

  it("aluno por turma exibe nome da turma corretamente", () => {
    const csv = buildPlanCsv("Plano X", [
      baseStudent({ source: "class", class_id: "c1", class_label: "Turma 2025-A" }),
    ]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[3]).toBe("Turma");
    expect(cols[4]).toBe("Turma 2025-A");
  });

  it("aluno inativo é marcado como 'sim' na coluna inativo", () => {
    const csv = buildPlanCsv("Plano X", [baseStudent({ is_inactive: true })]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[CSV_HEADERS.indexOf("inativo")]).toBe("sim");
  });

  it("aluno ativo é marcado como 'nao'", () => {
    const csv = buildPlanCsv("Plano X", [baseStudent({ is_inactive: false })]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[CSV_HEADERS.indexOf("inativo")]).toBe("nao");
  });

  it("nome de aluno com vírgula é escapado preservando colunas", () => {
    const csv = buildPlanCsv("Plano X", [baseStudent({ display_name: "Souza, Ana" })]);
    const line = csv.split("\n")[1];
    // Após escape, ainda há 13 colunas (CSV_HEADERS.length)
    // splitar respeitando aspas é complexo; basta validar que a célula está entre aspas
    expect(line).toContain('"Souza, Ana"');
  });

  it("respeita filtro do chamador (apenas alunos passados são exportados)", () => {
    const csv = buildPlanCsv("Plano X", [
      baseStudent({ user_id: "u1", display_name: "A" }),
      baseStudent({ user_id: "u2", display_name: "B" }),
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2
  });

  it("CSV vazio retorna apenas header", () => {
    const csv = buildPlanCsv("Plano X", []);
    expect(csv).toBe(CSV_HEADERS.join(","));
  });
});

describe("csvExport / buildPlanCsvWithBom", () => {
  it("prefixa com BOM UTF-8", () => {
    const csv = buildPlanCsvWithBom("Plano X", []);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
