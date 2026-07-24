import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listRecentErrorsTool from "./tools/list-recent-errors";
import searchMemoryTool from "./tools/search-memory";
import createFlashcardTool from "./tools/create-flashcard";

// OAuth issuer MUST be the direct Supabase host (never .lovable.cloud).
// See app-mcp-server-authoring: build from VITE_SUPABASE_PROJECT_ID.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "enazizi-mcp",
  title: "ENAZIZI",
  version: "0.1.0",
  instructions:
    "Ferramentas do ENAZIZI (plataforma de estudos médicos). Use `whoami` para confirmar identidade, `list_recent_errors` para revisar o Banco de Erros do aluno, `search_tutor_memory` para consultar a memória pedagógica, e `create_flashcard` para adicionar cards ao deck do aluno. Todas as operações rodam como o usuário autenticado e respeitam RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listRecentErrorsTool, searchMemoryTool, createFlashcardTool],
});
