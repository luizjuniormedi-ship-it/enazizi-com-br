/**
 * Navigation Smoke Test
 * ------------------------------------------------------------------
 * Validação leve da integridade dos pontos cardeais de navegação:
 *   • Rotas principais (Visão Geral, Estudar, ENAFLIX) registradas
 *   • BottomTabBar com os 5 itens corretos e rotas certas
 *
 * NÃO é E2E. É apenas uma rede de segurança contra remoções acidentais
 * de rotas/itens críticos durante refatorações.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mocks mínimos para evitar Supabase / auth reais.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ count: 0, data: [] }),
        not: () => ({ count: 0, data: [] }),
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

import BottomTabBar from "@/components/layout/BottomTabBar";

function renderWithProviders(ui: React.ReactNode, route = "/dashboard") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Navigation smoke — BottomTabBar (mobile)", () => {
  it("renderiza os 5 itens cardeais", () => {
    renderWithProviders(<BottomTabBar />);
    for (const label of ["Visão Geral", "Estudar", "ENAFLIX", "IA", "Perfil"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("aponta cada item para a rota correta", () => {
    renderWithProviders(<BottomTabBar />);
    const expected: Record<string, string> = {
      "Visão Geral": "/dashboard",
      Estudar: "/dashboard/sessao-estudo",
      ENAFLIX: "/enaflix",
      IA: "/dashboard/chatgpt",
      Perfil: "/dashboard/perfil",
    };
    for (const [label, href] of Object.entries(expected)) {
      const link = screen.getByText(label).closest("a");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(href);
    }
  });
});

describe("Navigation smoke — App routes (estática)", () => {
  // Validação textual leve: garante que as rotas principais não
  // foram removidas do App.tsx por engano. Não monta a árvore inteira
  // (evita custo de mount de páginas pesadas com providers globais).
  const appSrc = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

  it.each([
    ['path="/dashboard"', "Visão Geral (layout)"],
    ['path="sessao-estudo"', "Estudar (rota filha do dashboard)"],
    ['path="/enaflix"', "ENAFLIX"],
  ])("rota %s (%s) está registrada em App.tsx", (needle) => {
    expect(appSrc).toContain(needle);
  });
});
