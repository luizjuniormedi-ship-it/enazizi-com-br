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
  name: "search_tutor_memory",
  title: "Search tutor memory",
  description:
    "Full-text search in the ENAZIZI tutor_knowledge_memory for entries visible to the signed-in user (own entries + promoted global knowledge). Returns question, topic, and a short answer summary.",
  inputSchema: {
    query: z.string().trim().min(2).describe("Search text (matches topic, subtopic, question, or answer summary)."),
    limit: z.number().int().min(1).max(25).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const pattern = `%${query}%`;
    const { data, error } = await sb
      .from("tutor_knowledge_memory")
      .select("id, topic, subtopic, specialty, question_original, answer_summary, quality_score, reuse_count, scope")
      .or(
        `question_original.ilike.${pattern},answer_summary.ilike.${pattern},topic.ilike.${pattern},subtopic.ilike.${pattern}`,
      )
      .order("quality_score", { ascending: false })
      .limit(limit);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
