import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(() => new Promise(() => {})),
  signOut: vi.fn(() => new Promise(() => {})),
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: authMocks.unsubscribe } },
      })),
      signOut: authMocks.signOut,
    },
  },
}));

const AuthStateProbe = () => {
  const { loading, user } = useAuth();
  return <div>{loading ? "loading" : user ? "authenticated" : "released"}</div>;
};

describe("AuthProvider bootstrap", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("libera loading mesmo quando sessão e limpeza local ficam pendentes", async () => {
    vi.useFakeTimers();
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByText("loading")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("released")).toBeInTheDocument();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
