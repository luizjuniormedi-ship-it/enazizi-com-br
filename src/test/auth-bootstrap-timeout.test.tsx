import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(() => new Promise(() => {})),
  signOut: vi.fn(() => new Promise(() => {})),
  unsubscribe: vi.fn(),
  authCallback: null as null | ((event: string, session: any) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      getUser: vi.fn(),
      onAuthStateChange: vi.fn((callback) => {
        authMocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: authMocks.unsubscribe } } };
      }),
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
    authMocks.authCallback = null;
    window.history.replaceState({}, "", "/");
  });

  it("não inicia getSession concorrente na tela de login", async () => {
    window.history.replaceState({}, "", "/login");

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByText("released")).toBeInTheDocument();
    expect(authMocks.getSession).not.toHaveBeenCalled();
  });

  it("libera loading sem apagar credenciais quando a sessão fica pendente", async () => {
    vi.useFakeTimers();
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByText("loading")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(screen.getByText("released")).toBeInTheDocument();
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it("não apaga uma sessão criada enquanto o bootstrap antigo expira", async () => {
    vi.useFakeTimers();
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    const authenticatedSession = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      user: { id: "professor-1", created_at: new Date().toISOString() },
    };

    await act(async () => {
      authMocks.authCallback?.("SIGNED_IN", authenticatedSession);
      await vi.advanceTimersByTimeAsync(8000);
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText("authenticated")).toBeInTheDocument();
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });
});
