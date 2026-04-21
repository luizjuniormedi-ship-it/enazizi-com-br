/**
 * Integration tests — replan / criação / recálculo.
 *
 * Cobre fluxos críticos que tocam a edge function `proficiency-planner`:
 *   - useCreateProfessorPlan: insere plano + targets + subtopics
 *   - useAddPlanSubtopics: adiciona subtemas e dispara teacher_update por aluno
 *   - useRecalcProficiencyProgress: invoca proficiency-progress-recalc
 *   - useGenerateProficiencyPlan: invoca proficiency-planner
 *
 * Todos usam o mock leve de Supabase para não tocar rede.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createSupabaseMock } from "../__mocks__/supabaseMock";

const { mock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createSupabaseMock } = require("../__mocks__/supabaseMock");
  return { mock: createSupabaseMock() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: () => {} }),
}));

import { useCreateProfessorPlan } from "@/hooks/useProfessorPlans";
import { useAddPlanSubtopics } from "@/hooks/useProficiencyReplan";
import { useRecalcProficiencyProgress } from "@/hooks/useProficiencyReplan";
import { useGenerateProficiencyPlan } from "@/hooks/useProficiencyPlanner";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => {
  mock.setUser({ id: "prof-1", email: "prof@x.com" });
  mock.calls.invokes.length = 0;
  mock.calls.inserts.length = 0;
  mock.calls.updates.length = 0;
});

describe("useCreateProfessorPlan", () => {
  it("insere plano + targets (user e class) + subtopics na ordem correta", async () => {
    mock.setTable("professor_plans", []);
    mock.setTable("professor_plan_targets", []);
    mock.setTable("professor_plan_subtopics", []);

    const { result } = renderHook(() => useCreateProfessorPlan(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        name: "Plano A",
        exam_date: "2026-06-01",
        intensity: "moderado",
        notes: "obs",
        target_user_ids: ["u1", "u2"],
        target_class_ids: ["c1"],
        subtopic_ids: ["s1", "s2", "s3"],
      });
    });

    const tables = mock.calls.inserts;
    const plansInsert = tables.find((c) => c.table === "professor_plans");
    expect(plansInsert).toBeTruthy();
    expect(plansInsert!.rows[0].name).toBe("Plano A");
    expect(plansInsert!.rows[0].created_by).toBe("prof-1");

    const targetsInsert = tables.find((c) => c.table === "professor_plan_targets");
    expect(targetsInsert!.rows).toHaveLength(3);

    const subsInsert = tables.find((c) => c.table === "professor_plan_subtopics");
    expect(subsInsert!.rows).toHaveLength(3);
    expect(subsInsert!.rows[0].sort_order).toBe(0);
    expect(subsInsert!.rows[2].sort_order).toBe(2);
  });
});

describe("useAddPlanSubtopics", () => {
  it("dispara replan teacher_update para cada aluno alvo", async () => {
    // Plano existente com 0 subtemas
    mock.setTable("professor_plan_subtopics", []);
    mock.setTable("professor_plan_targets", [
      { plan_id: "p1", user_id: "stu-1", class_id: null },
      { plan_id: "p1", user_id: null, class_id: "class-1" },
    ]);
    mock.setTable("class_members", [
      { class_id: "class-1", user_id: "stu-2", is_active: true },
    ]);
    mock.setFunctionHandler("proficiency-planner", () => ({ ok: true, insertedTasks: 5 }));

    const { result } = renderHook(() => useAddPlanSubtopics(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ planId: "p1", subtopicIds: ["s1", "s2"] });
    });

    // 2 subtemas inseridos
    const subInsert = mock.calls.inserts.find((c) => c.table === "professor_plan_subtopics");
    expect(subInsert!.rows).toHaveLength(2);

    // 2 invocações da edge: 1 por aluno (stu-1 direto + stu-2 via turma)
    const planInvokes = mock.calls.invokes.filter((c) => c.name === "proficiency-planner");
    expect(planInvokes).toHaveLength(2);
    planInvokes.forEach((inv) => {
      expect(inv.body.reason).toBe("teacher_update");
      expect(inv.body.planId).toBe("p1");
    });
    const targets = planInvokes.map((i) => i.body.targetUserId).sort();
    expect(targets).toEqual(["stu-1", "stu-2"]);
  });

  it("não duplica subtemas que já estão no plano", async () => {
    mock.setTable("professor_plan_subtopics", [
      { plan_id: "p1", subtopic_id: "s1", sort_order: 0 },
    ]);
    mock.setTable("professor_plan_targets", []);
    mock.setTable("class_members", []);
    mock.setFunctionHandler("proficiency-planner", () => ({ ok: true }));

    const { result } = renderHook(() => useAddPlanSubtopics(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ planId: "p1", subtopicIds: ["s1", "s2"] });
    });

    // Só s2 (novo) deve ser inserido
    const subInsert = mock.calls.inserts.find((c) => c.table === "professor_plan_subtopics");
    expect(subInsert!.rows).toHaveLength(1);
    expect(subInsert!.rows[0].subtopic_id).toBe("s2");
  });
});

describe("useRecalcProficiencyProgress", () => {
  it("invoca proficiency-progress-recalc com planId", async () => {
    mock.setFunctionHandler("proficiency-progress-recalc", () => ({
      ok: true,
      progress: { completed: 3, pending: 7, overdue: 1, total: 10, progressPercent: 30, currentWeek: 1, weeklyStatus: "partial", weekDone: 1, weekTotal: 3 },
      replanTriggered: false,
    }));

    const { result } = renderHook(() => useRecalcProficiencyProgress(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ planId: "p1" });
    });

    const inv = mock.calls.invokes.find((c) => c.name === "proficiency-progress-recalc");
    expect(inv).toBeTruthy();
    expect(inv!.body).toMatchObject({ planId: "p1", skipReplan: false });
  });
});

describe("useGenerateProficiencyPlan", () => {
  it("invoca proficiency-planner com planId e propaga retorno", async () => {
    mock.setFunctionHandler("proficiency-planner", (body) => ({
      ok: true,
      planId: body.planId,
      examDate: "2026-12-01",
      daysUntil: 200,
      intensity: "moderado",
      studyDays: 100,
      subtopicsCount: 10,
      generatedTasks: 30,
      insertedTasks: 30,
      skippedDuplicates: 0,
    }));

    const { result } = renderHook(() => useGenerateProficiencyPlan(), { wrapper });
    let returned: any;
    await act(async () => {
      returned = await result.current.mutateAsync("plan-z");
    });

    expect(returned.ok).toBe(true);
    expect(returned.insertedTasks).toBe(30);
    const inv = mock.calls.invokes.find((c) => c.name === "proficiency-planner");
    expect(inv!.body).toEqual({ planId: "plan-z" });
  });

  it("propaga erro retornado pela edge", async () => {
    mock.setFunctionHandler("proficiency-planner", () => {
      throw new Error("Plano sem subtemas");
    });

    const { result } = renderHook(() => useGenerateProficiencyPlan(), { wrapper });
    await expect(
      act(async () => {
        await result.current.mutateAsync("plan-empty");
      }),
    ).rejects.toThrow(/Plano sem subtemas/);
  });
});
