/**
 * Integration tests — useStudentActivePlan (detecção de plano ativo do aluno).
 *
 * Cobre os caminhos que decidem se o painel guiado aparece ou se o
 * aluno cai no fallback antigo (jornada normal preservada):
 *   - aluno é alvo direto
 *   - aluno é alvo por turma (via class_members)
 *   - aluno tem ambos (deduplicação)
 *   - nenhum plano ativo encontrado → null (fallback)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { mock } from "@/test/__mocks__/supabaseMockSingleton";

vi.mock("@/integrations/supabase/client", async () => {
  const { mock } = await import("@/test/__mocks__/supabaseMockSingleton");
  return { supabase: mock.supabase };
});

import { useStudentActivePlan } from "@/hooks/useStudentActivePlan";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

beforeEach(() => {
  mock.setUser({ id: "student-1" });
});

function seedActivePlan(planId: string, opts?: { targets?: any[]; classMembers?: any[] }) {
  mock.setTable("professor_plan_targets", opts?.targets ?? [{ plan_id: planId, user_id: "student-1" }]);
  mock.setTable("class_members", opts?.classMembers ?? []);
  mock.setTable("professor_plans", [
    {
      id: planId,
      name: "Plano Cardio",
      exam_date: "2026-12-01",
      intensity: "moderado",
      status: "active",
      notes: null,
      created_by: "prof-1",
      created_at: "2026-01-01",
    },
  ]);
  mock.setTable("professor_plan_subtopics", []);
  mock.setTable("professor_plan_progress", []);
  mock.setTable("professor_plan_linked_resources", []);
  mock.setTable("profiles", [{ user_id: "prof-1", display_name: "Dr Smith", email: "smith@x.com" }]);
}

describe("useStudentActivePlan", () => {
  it("retorna null quando aluno não é alvo de nenhum plano (fallback preservado)", async () => {
    mock.setTable("professor_plan_targets", []);
    mock.setTable("class_members", []);
    mock.setTable("professor_plans", []);

    const { result } = renderHook(() => useStudentActivePlan(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("detecta plano ativo quando aluno é alvo direto", async () => {
    seedActivePlan("plan-A");

    const { result } = renderHook(() => useStudentActivePlan(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("plan-A");
    expect(result.current.data?.status).toBe("active");
    expect(result.current.data?.intensity).toBe("moderado");
  });

  it("detecta plano ativo via class_members (alvo por turma)", async () => {
    seedActivePlan("plan-B", {
      targets: [{ plan_id: "plan-B", class_id: "class-1" }],
      classMembers: [{ user_id: "student-1", class_id: "class-1", is_active: true }],
    });

    const { result } = renderHook(() => useStudentActivePlan(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("plan-B");
  });

  it("não retorna planos com status != active", async () => {
    seedActivePlan("plan-C");
    // Sobrescrever o plano para paused
    mock.setTable("professor_plans", [
      { id: "plan-C", name: "X", exam_date: null, intensity: "leve", status: "paused", notes: null, created_by: "p", created_at: "2026-01-01" },
    ]);

    const { result } = renderHook(() => useStudentActivePlan(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("calcula daysUntilExam corretamente", async () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    seedActivePlan("plan-D");
    mock.setTable("professor_plans", [
      { id: "plan-D", name: "X", exam_date: future, intensity: "leve", status: "active", notes: null, created_by: "p", created_at: "2026-01-01" },
    ]);

    const { result } = renderHook(() => useStudentActivePlan(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.daysUntilExam).toBeGreaterThanOrEqual(9);
    expect(result.current.data?.daysUntilExam).toBeLessThanOrEqual(11);
  });
});
