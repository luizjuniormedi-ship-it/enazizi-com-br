/**
 * Mock leve de `@/integrations/supabase/client` para testes de integração.
 *
 * Suporta o subset de chamadas usado pelos hooks da Proficiência Guiada:
 *   - .from(table).select(cols).eq/in/or/gte/lt/contains/order/limit/maybeSingle
 *   - .from(table).insert/update/delete/upsert
 *   - .auth.getUser()
 *   - .functions.invoke(name, { body })
 *   - .rpc(name, args)
 *
 * Padrão de uso:
 *   const { supabase, setUser, setTable, setFunctionHandler, calls } = createSupabaseMock();
 *   vi.mock("@/integrations/supabase/client", () => ({ supabase }));
 */
import { vi } from "vitest";

type Row = Record<string, any>;

interface QueryState {
  table: string;
  filters: Array<{ kind: string; col?: string; val?: any; vals?: any[] }>;
  selected?: string;
  ordered?: { col: string; ascending: boolean };
  limited?: number;
}

export interface SupabaseMockController {
  supabase: any;
  setUser: (u: { id: string; email?: string } | null) => void;
  setTable: (table: string, rows: Row[]) => void;
  setFunctionHandler: (name: string, handler: (body: any) => any) => void;
  setRpcHandler: (name: string, handler: (args: any) => any) => void;
  calls: {
    inserts: Array<{ table: string; rows: Row[] }>;
    updates: Array<{ table: string; patch: Row; filters: any[] }>;
    deletes: Array<{ table: string; filters: any[] }>;
    upserts: Array<{ table: string; rows: Row[]; opts?: any }>;
    invokes: Array<{ name: string; body: any }>;
    rpcs: Array<{ name: string; args: any }>;
  };
}

function applyFilters(rows: Row[], filters: QueryState["filters"]): Row[] {
  return rows.filter((r) => {
    for (const f of filters) {
      if (f.kind === "eq" && r[f.col!] !== f.val) return false;
      if (f.kind === "in" && !f.vals!.includes(r[f.col!])) return false;
      if (f.kind === "gte" && !(r[f.col!] >= f.val)) return false;
      if (f.kind === "lt" && !(r[f.col!] < f.val)) return false;
      if (f.kind === "contains") {
        const v = r[f.col!];
        const target = f.val;
        if (!v || typeof v !== "object") return false;
        for (const k of Object.keys(target)) {
          if (v[k] !== target[k]) return false;
        }
      }
      if (f.kind === "or") {
        // formato simples: "user_id.eq.UUID,user_id.is.null"
        const parts = String(f.val).split(",");
        const ok = parts.some((p) => {
          const [col, op, ...rest] = p.split(".");
          const val = rest.join(".");
          if (op === "eq") return String(r[col]) === val;
          if (op === "is" && val === "null") return r[col] == null;
          return false;
        });
        if (!ok) return false;
      }
    }
    return true;
  });
}

export function createSupabaseMock(): SupabaseMockController {
  const tables: Record<string, Row[]> = {};
  const funcHandlers: Record<string, (body: any) => any> = {};
  const rpcHandlers: Record<string, (args: any) => any> = {};
  let currentUser: { id: string; email?: string } | null = null;

  const calls: SupabaseMockController["calls"] = {
    inserts: [],
    updates: [],
    deletes: [],
    upserts: [],
    invokes: [],
    rpcs: [],
  };

  function buildBuilder(table: string, mode: "select" | "mutate") {
    const state: QueryState = { table, filters: [] };
    let mutationKind: "insert" | "update" | "delete" | "upsert" | null = null;
    let mutationPayload: any = null;
    let upsertOpts: any = null;

    const exec = (single: "single" | "maybeSingle" | null = null) => {
      const rows = tables[table] ?? [];
      let filtered = applyFilters(rows, state.filters);
      if (state.ordered) {
        const { col, ascending } = state.ordered;
        filtered = [...filtered].sort((a, b) => {
          const va = a[col], vb = b[col];
          if (va === vb) return 0;
          const cmp = va < vb ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (typeof state.limited === "number") filtered = filtered.slice(0, state.limited);
      if (single === "single") return Promise.resolve({ data: filtered[0] ?? null, error: filtered[0] ? null : { message: "no rows" } });
      if (single === "maybeSingle") return Promise.resolve({ data: filtered[0] ?? null, error: null });
      return Promise.resolve({ data: filtered, error: null });
    };

    const builder: any = {
      select: (cols?: string) => { state.selected = cols; return builder; },
      eq: (col: string, val: any) => { state.filters.push({ kind: "eq", col, val }); return builder; },
      in: (col: string, vals: any[]) => { state.filters.push({ kind: "in", col, vals }); return builder; },
      gte: (col: string, val: any) => { state.filters.push({ kind: "gte", col, val }); return builder; },
      lt: (col: string, val: any) => { state.filters.push({ kind: "lt", col, val }); return builder; },
      or: (val: string) => { state.filters.push({ kind: "or", val }); return builder; },
      contains: (col: string, val: any) => { state.filters.push({ kind: "contains", col, val }); return builder; },
      order: (col: string, opts?: { ascending?: boolean }) => {
        state.ordered = { col, ascending: opts?.ascending ?? true };
        return builder;
      },
      limit: (n: number) => { state.limited = n; return builder; },
      single: () => exec("single"),
      maybeSingle: () => exec("maybeSingle"),
      then: (resolve: any, reject: any) => exec(null).then(resolve, reject),
      // mutations
      insert: (rows: Row | Row[]) => {
        mutationKind = "insert";
        const arr = Array.isArray(rows) ? rows : [rows];
        mutationPayload = arr;
        calls.inserts.push({ table, rows: arr });
        tables[table] = [...(tables[table] ?? []), ...arr];
        const chain: any = {
          select: (_c?: string) => ({
            single: () => Promise.resolve({ data: arr[0], error: null }),
            maybeSingle: () => Promise.resolve({ data: arr[0], error: null }),
          }),
          then: (resolve: any) => Promise.resolve({ data: arr, error: null }).then(resolve),
        };
        return chain;
      },
      update: (patch: Row) => {
        mutationKind = "update";
        mutationPayload = patch;
        const finishUpdate = () => {
          calls.updates.push({ table, patch, filters: [...state.filters] });
          tables[table] = (tables[table] ?? []).map((r) =>
            applyFilters([r], state.filters).length ? { ...r, ...patch } : r,
          );
          return Promise.resolve({ data: null, error: null });
        };
        const updateBuilder: any = {
          eq: (col: string, val: any) => { state.filters.push({ kind: "eq", col, val }); return updateBuilder; },
          in: (col: string, vals: any[]) => { state.filters.push({ kind: "in", col, vals }); return updateBuilder; },
          then: (resolve: any) => finishUpdate().then(resolve),
        };
        return updateBuilder;
      },
      delete: () => {
        mutationKind = "delete";
        const finishDelete = () => {
          calls.deletes.push({ table, filters: [...state.filters] });
          tables[table] = (tables[table] ?? []).filter(
            (r) => applyFilters([r], state.filters).length === 0,
          );
          return Promise.resolve({ data: null, error: null });
        };
        const delBuilder: any = {
          eq: (col: string, val: any) => { state.filters.push({ kind: "eq", col, val }); return delBuilder; },
          in: (col: string, vals: any[]) => { state.filters.push({ kind: "in", col, vals }); return delBuilder; },
          gte: (col: string, val: any) => { state.filters.push({ kind: "gte", col, val }); return delBuilder; },
          contains: (col: string, val: any) => { state.filters.push({ kind: "contains", col, val }); return delBuilder; },
          then: (resolve: any) => finishDelete().then(resolve),
        };
        return delBuilder;
      },
      upsert: (rows: Row | Row[], opts?: any) => {
        mutationKind = "upsert";
        upsertOpts = opts;
        const arr = Array.isArray(rows) ? rows : [rows];
        mutationPayload = arr;
        calls.upserts.push({ table, rows: arr, opts });
        // Naive upsert: replace if onConflict cols match, else insert
        const conflictCols = String(opts?.onConflict ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        if (conflictCols.length > 0) {
          const existing = tables[table] ?? [];
          for (const newRow of arr) {
            const idx = existing.findIndex((r) => conflictCols.every((c) => r[c] === newRow[c]));
            if (idx >= 0) existing[idx] = { ...existing[idx], ...newRow };
            else existing.push(newRow);
          }
          tables[table] = existing;
        } else {
          tables[table] = [...(tables[table] ?? []), ...arr];
        }
        return Promise.resolve({ data: arr, error: null });
      },
    };
    return builder;
  }

  const supabase = {
    from: (table: string) => buildBuilder(table, "select"),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser }, error: null })),
    },
    functions: {
      invoke: vi.fn(async (name: string, opts: { body?: any }) => {
        calls.invokes.push({ name, body: opts?.body });
        const handler = funcHandlers[name];
        if (!handler) return { data: { ok: true }, error: null };
        try {
          const data = await handler(opts?.body);
          return { data, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err?.message ?? String(err) } };
        }
      }),
    },
    rpc: vi.fn(async (name: string, args: any) => {
      calls.rpcs.push({ name, args });
      const handler = rpcHandlers[name];
      if (!handler) return { data: null, error: null };
      return { data: handler(args), error: null };
    }),
  };

  return {
    supabase,
    setUser: (u) => { currentUser = u; },
    setTable: (table, rows) => { tables[table] = [...rows]; },
    setFunctionHandler: (name, handler) => { funcHandlers[name] = handler; },
    setRpcHandler: (name, handler) => { rpcHandlers[name] = handler; },
    calls,
  };
}
