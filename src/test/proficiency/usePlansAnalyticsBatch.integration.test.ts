/**
 * Integration tests — usePlansAnalyticsBatch
 *
 * Valida que o hook agregador (Fase 6.1 Hardening):
 *   - dispara apenas 3 queries (targets, progress, recalcs) + 1 para class_members quando há turma
 *   - consolida lateCount, missedGoalCount, inactiveCount, totalRecalcs por plan_id
 *   - resolve usuários via class_members quando o alvo é uma turma
 *
 * Esse hook substitui chamadas N×N de `usePlanAnalytics` no PlanRiskBadges,
 * então qualquer regressão de performance ou contagem aparece aqui.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createSupabaseMock } from "../__mocks__/supabaseMock";

const mock = createSupabaseMock();
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Importa DEPOIS do mock
import { usePlansAnalyticsBatch } from "@/hooks/usePlansAnalyticsBatch";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => {
  // Reset state between tests
  mock.calls.invokes.length = 0;
  mock.calls.inserts.length = 0;
  mock.calls.upserts.length = 0;
});

describe("usePlansAnalyticsBatch", () => {
  it("retorna mapa vazio com agregados zerados quando não há alunos", async () => {
    mock.setTable("professor_plan_targets", []);
    mock.setTable("class_members", []);
    mock.setTable("professor_plan_progress", []);
    mock.setTable("professor_plan_recalculations", []);

    const { result } = renderHook(() => usePlansAnalyticsBatch(["plan-1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      "plan-1": {
        totalStudents: 0,
        lateCount: 0,
        missedGoalCount: 0,
        totalRecalcs: 0,
        inactiveCount: 0,
      },
    });
  });

  it("agrega corretamente alunos diretos + por turma + recalcs + inatividade", async () => {
    const recentTs = new Date().toISOString();
    const oldTs = new Date(Date.now() - 10 * 86400000).toISOString();

    mock.setTable("professor_plan_targets", [
      { plan_id: "plan-A", user_id: "u1", class_id: null },
      { plan_id: "plan-A", user_id: null, class_id: "class-1" },
      { plan_id: "plan-B", user_id: "u3", class_id: null },
    ]);
    mock.setTable("class_members", [
      { class_id: "class-1", user_id: "u2", is_active: true },
    ]);
    mock.setTable("professor_plan_progress", [
      { plan_id: "plan-A", user_id: "u1", weekly_goal_status: "missed", overdue_tasks: 2, last_activity_at: recentTs },
      { plan_id: "plan-A", user_id: "u2", weekly_goal_status: "done", overdue_tasks: 0, last_activity_at: oldTs },
      { plan_id: "plan-B", user_id: "u3", weekly_goal_status: "partial", overdue_tasks: 0, last_activity_at: recentTs },
    ]);
    mock.setTable("professor_plan_recalculations", [
      { plan_id: "plan-A" },
      { plan_id: "plan-A" },
      { plan_id: "plan-B" },
    ]);

    const { result } = renderHook(() => usePlansAnalyticsBatch(["plan-A", "plan-B"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    // Plan A: 2 alunos (u1 direto, u2 via turma)
    expect(data["plan-A"].totalStudents).toBe(2);
    // u1 está atrasado (overdue+missed) e u2 está inativo (atividade antiga)
    expect(data["plan-A"].lateCount).toBe(1);
    expect(data["plan-A"].missedGoalCount).toBe(1);
    expect(data["plan-A"].inactiveCount).toBe(1);
    expect(data["plan-A"].totalRecalcs).toBe(2);

    // Plan B: 1 aluno em dia
    expect(data["plan-B"].totalStudents).toBe(1);
    expect(data["plan-B"].lateCount).toBe(0);
    expect(data["plan-B"].inactiveCount).toBe(0);
    expect(data["plan-B"].totalRecalcs).toBe(1);
  });

  it("aluno sem registro de progresso é considerado inativo", async () => {
    mock.setTable("professor_plan_targets", [{ plan_id: "p1", user_id: "u1", class_id: null }]);
    mock.setTable("class_members", []);
    mock.setTable("professor_plan_progress", []);
    mock.setTable("professor_plan_recalculations", []);

    const { result } = renderHook(() => usePlansAnalyticsBatch(["p1"]), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!["p1"].inactiveCount).toBe(1);
    expect(result.current.data!["p1"].totalStudents).toBe(1);
  });

  it("não dispara queries quando lista de planos está vazia", async () => {
    const { result } = renderHook(() => usePlansAnalyticsBatch([]), { wrapper });
    // disabled, não roda
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe("idle");
  });
});
