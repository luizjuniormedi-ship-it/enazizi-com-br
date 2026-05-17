import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "test-token" },
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const createChainMock = () => {
  const chain: any = {};
  const methods = ["select", "eq", "not", "order", "limit", "maybeSingle", "insert", "delete", "update", "gte", "single"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any) => resolve({ data: null, error: null });
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => createChainMock(),
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

describe("DashboardSidebar", () => {
  it("renders ENAZIZI branding", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const DashboardSidebar = (await import("@/components/enaflix/EnaflixSidebar")).EnaflixSidebar;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardSidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("ENAZIZI")).toBeInTheDocument();
  });

  it("renders Tutor IA link", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const DashboardSidebar = (await import("@/components/enaflix/EnaflixSidebar")).EnaflixSidebar;
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardSidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText("Tutor IA")).toBeInTheDocument();
  });

  it("renders without crashing", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const DashboardSidebar = (await import("@/components/enaflix/EnaflixSidebar")).EnaflixSidebar;
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardSidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });
});
