import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Deep chainable mock for supabase
const createChainMock = () => {
  const chain: any = {};
  const methods = ["select", "eq", "not", "order", "limit", "maybeSingle", "insert", "delete", "update", "gte", "single"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any) => resolve({ data: [], error: null, count: 0 });
  return chain;
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "test-token" },
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => createChainMock(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    functions: {
      invoke: () => Promise.resolve({ data: {}, error: null }),
    },
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: () => ({ unsubscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
  },
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Agent Pages render correctly", () => {
  it("AIMentor renders without crashing", async () => {
    const AIMentor = (await import("@/pages/AIMentor")).default;
    const { container } = renderWithProviders(<AIMentor />);
    expect(container.firstChild).toBeTruthy();
  }, 10000);

  it("QuestionGenerator renders without crashing", async () => {
    const QuestionGenerator = (await import("@/pages/QuestionGenerator")).default;
    const { container } = renderWithProviders(<QuestionGenerator />);
    expect(container.firstChild).toBeTruthy();
  });

  it("ContentSummarizer renders without crashing", async () => {
    const ContentSummarizer = (await import("@/pages/ContentSummarizer")).default;
    const { container } = renderWithProviders(<ContentSummarizer />);
    expect(container.firstChild).toBeTruthy();
  });

  it("MotivationalCoach renders without crashing", async () => {
    const MotivationalCoach = (await import("@/pages/MotivationalCoach")).default;
    const { container } = renderWithProviders(<MotivationalCoach />);
    expect(container.firstChild).toBeTruthy();
  });
});
