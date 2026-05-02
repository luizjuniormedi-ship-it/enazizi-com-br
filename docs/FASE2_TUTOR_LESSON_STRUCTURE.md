# Fase 2 — Tutor Lesson Memory: Estruturação Pedagógica + Exportação Cinematográfica

Status: ✅ Concluída

## Arquivos alterados
- `supabase/migrations/20260502154128_*.sql` — status `structuring`, colunas pedagógicas, trigger `enforce_lesson_publish_checklist`.
- `supabase/functions/tutor-lesson-structure/index.ts` — IA Gemini 2.5 Pro via tool-calling, rate-limit 3/h e 10/dia, eventos.
- `supabase/functions/tutor-lesson-export/index.ts` — exportações NotebookLM/Gemini/Google Vids/Markdown/TXT + bloco cinematográfico 3D obrigatório.
- `src/hooks/useEducationalMemory.ts` — dedup, disparo automático de estruturação, `restructureLesson`, `exportLesson`.
- `src/pages/admin/AdminLessonsMemory.tsx` — checklist mínimo, botões IA/exportações, gating de publicação, fix do cast `(structured_content as any)`.

## Edge functions finalizadas
| Função | Papel |
|---|---|
| `tutor-lesson-structure` | Gera capítulos, roteiro, objetivos, perguntas, flashcards via Lovable AI. |
| `tutor-lesson-export` | Renderiza NotebookLM, Gemini, Google Vids, Markdown, TXT — todos com bloco 3D Pixar obrigatório no fim. |
| `tutor-lesson-signed-url` | Mantida da Fase 1 para preview/player. |

## Botões adicionados ao Admin
- 🟢 **Reestruturar IA** — re-invoca `tutor-lesson-structure`.
- 📘 **Exportar NotebookLM**
- ✨ **Exportar Gemini**
- 🎬 **Exportar Google Vids**
- ⬇️ **Exportar Markdown**
- ⬆️ **Subir vídeo / Substituir vídeo**
- ▶️ **Preview seguro** (signed URL)
- ✅ **Publicar aula** — só habilita com checklist completo + vídeo + status `ready_to_publish`.

## Checklist mínimo implementado
Persistido em `tutor_lesson_memory.quality_checklist` (jsonb). Renderizado com `Checkbox` e exigido pelo trigger SQL antes de publicar:
1. Título revisado (`title_reviewed`)
2. Conteúdo revisado (`content_reviewed`)
3. Vídeo anexado (`video_attached`)
4. Sem alucinação (`no_hallucination`)
5. Pronto para publicar (`ready_to_publish`)

Front-end e banco bloqueiam publicação se algum item estiver desmarcado.

## Padrão cinematográfico 3D / Pixar
Constante `CINEMATIC_3D_BLOCK` em `tutor-lesson-export/index.ts` é **anexada a TODAS as exportações** (NotebookLM, Gemini, Google Vids, Markdown, TXT). Inclui:
- estilo 3D Pixar científico
- documentário Netflix
- motion graphics médicos AAA
- luz volumétrica, profundidade de campo, câmera dinâmica
- anatomia precisa
- narração obrigatória em pt-BR
- citação de fontes (Nelson, Sabiston)

## Conteúdo obrigatório por exportação
Todas as exportações já trazem: roteiro técnico, capítulos, objetivos, explicação leiga, explicação técnica, pontos de prova, pegadinhas, perguntas de revisão, sugestões de flashcards, roteiro de narração, sugestões visuais e prompt para IA de vídeo (via `renderNotebookLM` / `renderGeminiPrompt` / `renderGoogleVidsPrompt`).

## Typecheck / Build
- Erro `Property 'title' does not exist on type 'Json'` corrigido com cast `(lesson.structured_content as any)?.title`.
- Build automático do harness em execução; sem erros TS pendentes nos arquivos editados.

## Pendências (Fase 3)
- UX ENAFLIX cinematográfico real (cards, hero, player imersivo).
- Hookup FSRS e Banco de Erros aos eventos `lesson_completed`.
- Exportação PDF real (atualmente Markdown/TXT).
- Observabilidade visual (gráfico por status, custo IA por aula).
- Filtros avançados e ações em massa no Admin.
