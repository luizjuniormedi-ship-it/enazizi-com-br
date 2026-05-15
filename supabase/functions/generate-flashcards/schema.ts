import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const GenerateFlashcardsSchema = z.object({
  topic: z.string().min(1, "O tópico é obrigatório"),
  source: z.string().optional().default("manual"),
  userId: z.string().uuid("ID de usuário inválido"),
  context: z.string().optional(),
  decisionId: z.string().uuid().optional(),
  session_id: z.string().optional(),
});

export type GenerateFlashcardsRequest = z.infer<typeof GenerateFlashcardsSchema>;
