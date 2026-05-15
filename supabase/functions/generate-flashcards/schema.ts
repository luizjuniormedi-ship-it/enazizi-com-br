import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const GenerateFlashcardsSchema = z.object({
  topic: z.string().optional().default("Medicina Geral"),
  source: z.string().optional().default("manual"),
  userId: z.string().uuid("ID de usuário inválido"),
  context: z.string().optional(),
  userContext: z.string().optional(),
  messages: z.array(z.any()).optional(),
  adaptiveContext: z.any().optional(),
  adaptiveMeta: z.any().optional(),
  conversationId: z.string().optional(),
  subtopic: z.string().optional(),
  specialty: z.string().optional(),
  requestId: z.string().optional(),
  sessionId: z.string().optional(),
  decisionId: z.string().uuid().optional(),
  session_id: z.string().optional(),
});

export type GenerateFlashcardsRequest = z.infer<typeof GenerateFlashcardsSchema>;
