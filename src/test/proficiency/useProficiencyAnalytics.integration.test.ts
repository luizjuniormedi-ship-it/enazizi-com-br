/**
 * Integration tests — useProficiencyAnalytics (BI do professor por plano).
 *
 * Cobre a montagem do dashboard:
 *   - resolução de alunos diretos + por turma (sem duplicar)
 *   - cálculo de avgProgress, onTrackCount, lateCount, inactiveCount
 *   - separação de recalculations por tipo (missed_goal vs teacher_update)
 *   - rótulo da turma (`class_label`) carregado de `classes`
 *   - flag is_inactive considerando 3 dias
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createSupabaseMock } from "../__mocks__/supabaseMock";

const mock = createSupabaseMock();
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { usePlanAnalytics } from "@/hooks/useProficiencyAnalytics";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => {
  mock.calls.invokes.length = 0;
});

describe("usePlanAnalytics", () => {
  it("agrega progresso e separa recalcs por tipo", async () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 5 * 86400000).toISOString();

    mock.setTable("professor_plan_targets", [
      { plan_id: "p1", user_id: "u1", class_id: null },
      { plan_id: "p1", user_id: "u2", class_id: null },
      { plan_id: "p1", user_id: null, class_id: "c1" },
    ]);
    mock.setTable("class_members", [
      { user_id: "u3", class_id: "c1", is_active: true },
    ]);
    mock.setTable("classes", [{ id: "c1", name: "Turma A" }]);
    mock.setTable("profiles", [
      { user_id: "u1", display_name: "Ana", email: "ana@x.com", avatar_url: null },
      { user_id: "u2", display_name: "Bruno", email: "bruno@x.com", avatar_url: null },
      { user_id: "u3", display_name: "Carla", email: "carla@x.com", avatar_url: null },
    ]);
    mock.setTable("professor_plan_progress", [
      { plan_id: "p1", user_id: "u1", progress_percent: 80, weekly_goal_status: "done", completed_tasks: 8, pending_tasks: 2, overdue_tasks: 0, last_activity_at: recent },
      { plan_id: "p1", user_id: "u2", progress_percent: 30, weekly_goal_status: "missed", completed_tasks: 3, pending_tasks: 5, overdue_tasks: 4, last_activity_at: recent },
      { plan_id: "p1", user_id: "u3", progress_percent: 50, weekly_goal_status: "partial", completed_tasks: 5, pending_tasks: 5, overdue_tasks: 0, last_activity_at: old },
    ]);
    mock.setTable("professor_plan_recalculations", [
      { plan_id: "p1", user_id: "u2", recalculation_type: "missed_goal" },
      { plan_id: "p1", user_id: "u2", recalculation_type: "missed_goal" },
      { plan_id: "p1", user_id: null, recalculation_type: "teacher_update" },
    ]);

    const { result } = renderHook(() => usePlanAnalytics("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const r = result.current.data!;
    expect(r.summary.totalStudents).toBe(3);
    // avg = (80+30+50)/3 ≈ 53
    expect(r.summary.avgProgress).toBe(53);
    expect(r.summary.lateCount).toBe(1); // só u2
    expect(r.summary.onTrackCount).toBe(2); // u1 e u3 (overdue=0 e não missed)
    expect(r.summary.inactiveCount).toBe(1); // u3 está há 5 dias sem atividade
    expect(r.summary.totalRecalcs).toBe(3);
    expect(r.summary.missedGoalRecalcs).toBe(2);
    expect(r.summary.teacherUpdateRecalcs).toBe(1);

    // class_label populado para u3
    const u3 = r.students.find((s) => s.user_id === "u3")!;
    expect(u3.source).toBe("class");
    expect(u3.class_label).toBe("Turma A");
    expect(u3.is_inactive).toBe(true);

    const u1 = r.students.find((s) => s.user_id === "u1")!;
    expect(u1.source).toBe("direct");
    expect(u1.is_inactive).toBe(false);
  });

  it("plano sem alunos retorna summary zerado e listas vazias", async () => {
    mock.setTable("professor_plan_targets", []);
    mock.setTable("class_members", []);
    mock.setTable("classes", []);
    mock.setTable("profiles", []);
    mock.setTable("professor_plan_progress", []);
    mock.setTable("professor_plan_recalculations", []);

    const { result } = renderHook(() => usePlanAnalytics("empty-plan"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const r = result.current.data!;
    expect(r.summary.totalStudents).toBe(0);
    expect(r.summary.avgProgress).toBe(0);
    expect(r.students).toHaveLength(0);
  });
});
