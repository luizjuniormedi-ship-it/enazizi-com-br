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
  name: "create_flashcard",
  title: "Create flashcard",
  description:
    "Create a new flashcard in the ENAZIZI deck for the signed-in user. Use short, high-yield medical Q&A in pt-BR.",
  inputSchema: {
    question: z.string().trim().min(3),
    answer: z.string().trim().min(1),
    topic: z.string().trim().min(1).describe("Clinical topic, e.g. 'Cardiologia'."),
    subtopic: z.string().trim().optional(),
    explanation: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ question, answer, topic, subtopic, explanation }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("flashcards")
      .insert({
        user_id: ctx.getUserId(),
        question,
        answer,
        topic,
        subtopic: subtopic ?? null,
        explanation: explanation ?? null,
        source: "mcp",
      })
      .select("id, question, topic, subtopic, created_at")
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Flashcard criado: ${data.id}` }],
      structuredContent: { flashcard: data },
    };
  },
});
