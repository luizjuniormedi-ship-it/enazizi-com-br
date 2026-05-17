import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const createChainMock = () => {
  const chain: any = {};
  const methods = ["select", "eq", "neq", "not", "order", "limit", "maybeSingle", "insert", "delete", "update", "gte", "lte", "single", "in", "is", "or", "range", "ilike", "like", "contains", "textSearch", "filter", "match", "csv", "upsert"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any) => resolve({ data: [], error: null });
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => createChainMock()),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: "test" }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://test.com/file" } })),
        download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    })),
  },
}));
