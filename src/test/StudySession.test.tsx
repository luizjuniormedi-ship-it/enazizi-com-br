import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "test-token" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain: Record<string, any> = {};
      for (const method of ["select", "eq", "not", "order", "limit", "single", "insert", "update", "delete"]) {
        chain[method] = vi.fn(() => chain);
      }
      chain.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null });
      return chain;
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: () => ({
      on: function() { return this; },
      subscribe: () => ({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}));

describe("StudySession Page", () => {
  it("renders without crashing", async () => {
    const StudySession = (await import("@/pages/StudySession")).default;
    const { container } = render(<StudySession />, { wrapper: createWrapper() });
    expect(container.firstChild).toBeTruthy();
  }, 10000);
});
