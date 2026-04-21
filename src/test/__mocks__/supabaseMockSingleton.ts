/**
 * Singleton do mock Supabase para uso nos testes de integração.
 *
 * Por que existe: `vi.hoisted(() => require(...))` não passa pelo resolver
 * do Vite (alias `@/`), causando MODULE_NOT_FOUND. Centralizar o singleton
 * num módulo dedicado permite que `vi.mock("@/integrations/supabase/client")`
 * importe normalmente via ESM sem precisar de hoisted/require.
 *
 * Uso típico:
 *
 *   import { mock } from "@/test/__mocks__/supabaseMockSingleton";
 *   vi.mock("@/integrations/supabase/client", async () => {
 *     const { mock } = await import("@/test/__mocks__/supabaseMockSingleton");
 *     return { supabase: mock.supabase };
 *   });
 */
import { createSupabaseMock } from "./supabaseMock";

export const mock = createSupabaseMock();
