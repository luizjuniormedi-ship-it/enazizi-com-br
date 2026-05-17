import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "test-token" },
    signOut: vi.fn(),
  }),
}));

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
          not: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
          gte: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
        count: "exact",
        head: true,
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: () => ({ unsubscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
    functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
  },
}));

describe("AgentsHub Page", () => {
  it("renders all agent cards", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const AgentsHub = (await import("@/pages/AgentsHub")).default;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AgentsHub />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Agentes IA/)).toBeInTheDocument();
    expect(screen.getAllByText(/Tutor IA/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Gerador de Questões/)).toBeInTheDocument();
    expect(screen.getByText(/Gerador de Flashcards/)).toBeInTheDocument();
    expect(screen.getByText(/Resumidor de Conteúdo/)).toBeInTheDocument();
    expect(screen.getByText(/Modo Plantão/)).toBeInTheDocument();
    expect(screen.getByText(/Coach Motivacional/)).toBeInTheDocument();
  });

  it("has agent links", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const AgentsHub = (await import("@/pages/AgentsHub")).default;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AgentsHub />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(6);
  });

  it("renders without crashing", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const AgentsHub = (await import("@/pages/AgentsHub")).default;
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AgentsHub />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });
});
