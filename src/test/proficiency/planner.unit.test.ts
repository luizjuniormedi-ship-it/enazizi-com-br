/**
 * Unit tests — proficiency-planner shared helpers.
 *
 * Cobre as regras determinísticas extraídas para `_shared.ts`:
 *   - distribuição de datas por intensidade (buildStudyDates)
 *   - mapping de source por reason (resolveTaskSource)
 *   - cálculo de progress counts e weekly goal
 *   - regra de inatividade (3 dias)
 *
 * Esses testes são puros (sem Deno, sem rede, sem mock de DB) e protegem
 * as Fases 1–6 contra regressões silenciosas no núcleo do planner.
 */
import { describe, it, expect } from "vitest";
import {
  INTENSITY,
  SOURCE_MAP,
  addDays,
  buildStudyDates,
  computeProgressCounts,
  computeWeeklyGoalStatus,
  defaultReasonText,
  isStudentInactive,
  isoDate,
  resolveTaskSource,
} from "../../../supabase/functions/proficiency-planner/_shared";

describe("proficiency-planner / intensidades", () => {
  it("define exatamente 3 perfis de intensidade", () => {
    expect(Object.keys(INTENSITY).sort()).toEqual(["intenso", "leve", "moderado"]);
  });

  it("perfis respeitam dias úteis crescentes", () => {
    expect(INTENSITY.leve.daysPerWeek).toBeLessThan(INTENSITY.moderado.daysPerWeek);
    expect(INTENSITY.moderado.daysPerWeek).toBeLessThan(INTENSITY.intenso.daysPerWeek);
  });
});

describe("proficiency-planner / buildStudyDates", () => {
  // Segunda-feira UTC
  const monday = new Date("2026-01-05T00:00:00Z");
  const inTwoWeeks = addDays(monday, 14);

  it("intensidade leve: folga sex+sáb+dom (4 dias úteis)", () => {
    const dates = buildStudyDates(monday, inTwoWeeks, INTENSITY.leve.daysPerWeek);
    const dows = new Set(dates.map((d) => d.getUTCDay()));
    // 0=dom, 5=sex, 6=sáb não devem aparecer
    expect(dows.has(0)).toBe(false);
    expect(dows.has(5)).toBe(false);
    expect(dows.has(6)).toBe(false);
  });

  it("intensidade moderada: folga sáb+dom (5 dias úteis)", () => {
    const dates = buildStudyDates(monday, inTwoWeeks, INTENSITY.moderado.daysPerWeek);
    const dows = new Set(dates.map((d) => d.getUTCDay()));
    expect(dows.has(0)).toBe(false);
    expect(dows.has(6)).toBe(false);
    expect(dows.has(5)).toBe(true); // sex permitida
  });

  it("intensidade intensa: folga apenas dom (6 dias úteis)", () => {
    const dates = buildStudyDates(monday, inTwoWeeks, INTENSITY.intenso.daysPerWeek);
    const dows = new Set(dates.map((d) => d.getUTCDay()));
    expect(dows.has(0)).toBe(false);
    expect(dows.has(6)).toBe(true);
  });

  it("não gera datas após exam_date (limite superior inclusivo)", () => {
    const dates = buildStudyDates(monday, addDays(monday, 5), 5);
    const last = dates[dates.length - 1];
    expect(last.getTime()).toBeLessThanOrEqual(addDays(monday, 5).getTime());
  });

  it("retorna lista vazia se exam < start", () => {
    const yesterday = addDays(monday, -1);
    expect(buildStudyDates(monday, yesterday, 5)).toEqual([]);
  });
});

describe("proficiency-planner / source mapping", () => {
  it("mapeia cada RecalcType para o source correto", () => {
    expect(SOURCE_MAP.manual).toBe("planner");
    expect(SOURCE_MAP.auto).toBe("planner_auto");
    expect(SOURCE_MAP.missed_goal).toBe("replan_missed_goal");
    expect(SOURCE_MAP.teacher_update).toBe("replan_teacher_update");
  });

  it("resolveTaskSource cai em planner para reason undefined", () => {
    expect(resolveTaskSource(undefined)).toBe("planner");
  });

  it("resolveTaskSource respeita cada motivo", () => {
    expect(resolveTaskSource("missed_goal")).toBe("replan_missed_goal");
    expect(resolveTaskSource("teacher_update")).toBe("replan_teacher_update");
    expect(resolveTaskSource("auto")).toBe("planner_auto");
  });

  it("defaultReasonText cobre os quatro motivos", () => {
    expect(defaultReasonText("manual")).toMatch(/manual/i);
    expect(defaultReasonText("missed_goal")).toMatch(/meta/i);
    expect(defaultReasonText("teacher_update")).toMatch(/professor/i);
    expect(defaultReasonText("auto")).toMatch(/autom/i);
  });
});

describe("proficiency-planner / progress counts", () => {
  it("conta completed/pending/overdue corretamente", () => {
    const tasks = [
      { status: "completed" as const, planned_date: "2026-01-01" },
      { status: "completed" as const, planned_date: "2026-01-02" },
      { status: "pending" as const, planned_date: "2026-01-01" }, // overdue
      { status: "pending" as const, planned_date: "2026-12-31" }, // futuro
      { status: "skipped" as const, planned_date: "2026-01-01" },
    ];
    const c = computeProgressCounts(tasks, "2026-01-05");
    expect(c.total).toBe(5);
    expect(c.completed).toBe(2);
    expect(c.pending).toBe(2);
    expect(c.overdue).toBe(1);
    expect(c.progressPercent).toBe(40);
  });

  it("retorna 0% quando não há tarefas", () => {
    const c = computeProgressCounts([], "2026-01-01");
    expect(c.total).toBe(0);
    expect(c.progressPercent).toBe(0);
  });

  it("computeWeeklyGoalStatus → done ≥100%, partial ≥50%, missed <50%", () => {
    expect(computeWeeklyGoalStatus(10, 10)).toBe("done");
    expect(computeWeeklyGoalStatus(11, 10)).toBe("done");
    expect(computeWeeklyGoalStatus(5, 10)).toBe("partial");
    expect(computeWeeklyGoalStatus(4, 10)).toBe("missed");
    expect(computeWeeklyGoalStatus(0, 0)).toBe("partial"); // edge: sem tarefa
  });
});

describe("proficiency-planner / inatividade", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("aluno com last_activity_at null é inativo", () => {
    expect(isStudentInactive(null, now)).toBe(true);
    expect(isStudentInactive(undefined, now)).toBe(true);
  });

  it("aluno com atividade > 3 dias é inativo", () => {
    expect(isStudentInactive("2026-01-06T00:00:00Z", now)).toBe(true);
  });

  it("aluno com atividade recente (< 3 dias) é ativo", () => {
    expect(isStudentInactive("2026-01-09T00:00:00Z", now)).toBe(false);
  });

  it("data inválida é tratada como inativo (segurança)", () => {
    expect(isStudentInactive("not-a-date", now)).toBe(true);
  });
});

describe("proficiency-planner / utilitários de data", () => {
  it("isoDate retorna YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-04-21T15:30:00Z"))).toBe("2026-04-21");
  });

  it("addDays não muta a data original", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const next = addDays(base, 5);
    expect(isoDate(base)).toBe("2026-01-01");
    expect(isoDate(next)).toBe("2026-01-06");
  });
});
