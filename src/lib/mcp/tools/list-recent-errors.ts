import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_recent_errors",
  title: "List recent study errors",
  description:
    "Return the signed-in user's most recent items from the ENAZIZI Banco de Erros (error_bank), newest first. Useful to review weak topics.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of errors to return (1-50)."),
    only_undominated: z
      .boolean()
      .default(true)
      .describe("If true, return only errors the user has not yet mastered (dominado = false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_undominated }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("error_bank")
      .select("id, tema, subtema, categoria_erro, motivo_erro, vezes_errado, dominado, created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (only_undominated) q = q.eq("dominado", false);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { errors: data ?? [] },
    };
  },
});
