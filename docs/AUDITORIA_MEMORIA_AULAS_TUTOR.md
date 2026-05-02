# Auditoria do Sistema de Memória de Aulas do Tutor IA

> **Status real**: Sistema implementado parcialmente, com **vulnerabilidades críticas** e **dependências legadas do CME ainda presentes**.
> **Veredito**: ⚠️ **NÃO está pronto para uso real em produção.** Aparenta funcionar porque o caminho feliz foi codificado, mas tem 5 falhas de segurança críticas, 0 dados em produção (`tutor_lesson_memory` vazia), e RLS quebrada.
> **Data da auditoria**: Maio/2026
> **Escopo auditado**: schema, RLS, storage, edge functions, hooks, UI admin, UI aluno, player, observabilidade, integrações.

---

## TL;DR — Os 7 fatos que importam

1. **A tabela `tutor_lesson_memory` tem 0 linhas.** Nenhuma aula foi solicitada. O fluxo nunca foi executado de ponta a ponta em produção.
2. **RLS está quebrada.** As policies referenciam `profiles.role` (que existe mas viola a regra core do projeto: roles vivem em `public.user_roles`). Qualquer usuário com `profiles.role` editado vira admin — **escalada de privilégio trivial**.
3. **O bucket `tutor-lesson-videos` é público sem MIME, sem limite, e qualquer usuário autenticado pode fazer upload e DELETE.** A policy "Authenticated users can delete tutor videos" não filtra por owner.
4. **Não existe NENHUMA edge function dedicada ao fluxo.** Tudo é feito em cliente: estruturação, request, upload, publicação. Sem validação server-side, sem rate limit, sem auditoria server-side.
5. **CME não foi desconectado.** O `VideoLessonPlayer` ainda consulta `ai_video_lessons`, `cme_playback_audit_logs`, usa `useCinematicEngine`, `useCMEAnalytics`. O Tutor ainda chama `useTutorCME`.
6. **Apenas 1 evento real é emitido** (`lesson_requested`). Os outros 8 prometidos no roadmap (`structured`, `exported`, `uploaded`, `published`, `watched`, `completed`, `deleted`, `restored`) **não existem**.
7. **A "exportação NotebookLM" é um `JSON.stringify` jogado em `.txt`.** Não é PDF, não tem capítulos, não tem prompts, não tem fidelidade pedagógica.

---

## 1. AUDITORIA REAL DO FLUXO PONTA-A-PONTA

| Etapa | Status | Onde está | Problemas |
|---|---|---|---|
| 1. Tutor IA estrutura aula | ⚠️ Parcial | `TutorNextStepBlock.tsx:55` | Estrutura cliente-side, sem IA — só copia `topic/specialty/content` para um JSON cru |
| 2. Botão "Solicitar Aula" | ⚠️ Frágil | `TutorNextStepBlock.tsx:125` | Sem debounce, sem deduplicação, sem rate-limit, sem validação |
| 3. Persistência | ⚠️ Risco | `useEducationalMemory.ts:80` | Insert direto via cliente — nada impede um aluno de criar 10.000 aulas |
| 4. Fila admin | ✅ Existe | `AdminLessonsMemory.tsx` | Listagem funciona, mas sem paginação, sem ordenação, sem multi-select |
| 5. Estruturação pedagógica | ❌ Inexistente | — | `structured_content` recebe `{ original_prompt, requested_at }`. **Nenhum agente IA estrutura título, capítulos, objetivos, perguntas, pegadinhas, referências.** |
| 6. Exportação NotebookLM | ❌ Falsa | `AdminLessonsMemory.tsx:100` | `JSON.stringify(structured_content)` em `.txt`. Não é PDF, não tem capítulos, não tem prompts |
| 7. Upload de vídeo | ⚠️ Inseguro | `AdminLessonsMemory.tsx:45` | Upload direto cliente→bucket público; sem validação server-side; sem progress real (mostra `value=45` fixo) |
| 8. Publicação | ⚠️ Implícita | `AdminLessonsMemory.tsx:66` | Upload **automaticamente** seta `status=published`. Não existe estado de "pronto para publicar" — confunde curadoria com publicação |
| 9. Biblioteca aluno | ⚠️ Funcional, frágil | `MyLessonsPage.tsx` | Filtro client-side, sem paginação, busca todos os registros do usuário |
| 10. Player | ⚠️ Híbrido confuso | `VideoLessonPlayer.tsx` | Tenta `tutor_lesson_memory` primeiro, depois cai no `ai_video_lessons` (CME) — duas fontes, dois schemas |
| 11. Progresso | ⚠️ Existe, sem UI | `useEducationalMemory.ts:121` | `updateLessonProgress` existe mas **não é chamado pelo player** |
| 12. FSRS / Error Bank | ❌ Inexistente | — | Zero integração. Aulas não geram revisão, não influenciam prioridade |
| 13. Observabilidade | ❌ Quase inexistente | `tutor_lesson_events` | Apenas `lesson_requested` é emitido em 1 ponto |
| 14. Exclusão / restauração | ❌ Inexistente em UI | Schema só | Schema tem `deleted_at`, `hard_deleted`, `delete_reason` mas **nenhum botão / fluxo na UI** |

---

## 2. RESQUÍCIOS DO CME (Fluxo antigo NÃO desconectado)

### 2.1 Edge functions ativas
- `supabase/functions/cme-orchestrator/` — ativa
- `supabase/functions/cme-dev-worker/` — ativa
- `supabase/functions/cme-start-pipeline/` — ativa
- `supabase/functions/cme-status/` — ativa
- `supabase/functions/_shared/cme-render-config.ts` — compartilhado

### 2.2 Hooks ainda referenciados pelo Tutor / Player
| Hook / Componente | Onde | Risco |
|---|---|---|
| `useTutorCME` | `src/components/tutor/TutorMessageItem.tsx` | Tutor ainda dispara CME |
| `useCinematicEngine` | `VideoLessonPlayer.tsx:65` | Player chama engine cinematográfica |
| `useCMEAnalytics` | importado em hooks legados | Telemetria mista |
| `cme_playback_audit_logs` | `VideoLessonPlayer.tsx:166` | Player loga em tabela CME mesmo para aulas curadas |
| `ai_video_lessons` (fallback) | `VideoLessonPlayer.tsx:135` | Mantém compatibilidade dupla — gera bugs sutis |
| `CinematicSessionBuilder`, `CinematicBuilder`, `CMERenderModal` | rotas admin | Cinematic UI ainda exposta |

### 2.3 Componentes mortos no fluxo novo
- `RenderQueuesPanel`, `GPUFleetPanel`, `CMEMediaMonitor`, `CMEStatus`, `CMEIncidents` — todos relacionados ao pipeline GPU que **não é mais usado** para aulas curadas.
- Ainda visíveis em `Laboratório Técnico` no novo `AdminSidebarEnterprise` — correto manter como legado, **mas não há flag indicando isso**.

**Recomendação:** marcar todas essas rotas com badge `Legado` no `adminMenuConfig.ts`, ou movê-las para `_archive/` na Fase 2.

---

## 3. AUDITORIA DO BOTÃO "SOLICITAR AULA"

**Local**: `src/components/tutor/TutorNextStepBlock.tsx:125` (botão "Solicitar Aula Personalizada")
**Função**: `handleRequestLesson` → `requestLesson` (hook)

### Problemas
| # | Problema | Severidade |
|---|---|---|
| 1 | Sem debounce / sem rate-limit | 🔴 Crítico — aluno pode criar 1000 aulas/min |
| 2 | Sem deduplicação (mesmo `topic+specialty` insere de novo) | 🟠 Alto |
| 3 | `structured_content` recebe apenas `{ original_prompt, requested_at }` — perde contexto da sessão (mensagens, FSRS, erros, performance) | 🟠 Alto |
| 4 | Sem validação de input (título, topic) — pode criar aula vazia | 🟡 Médio |
| 5 | Feedback visual mínimo (`setShowSuccessDialog(true)`) — sem indicar tempo estimado de produção | 🟡 Médio |
| 6 | Não testado em mobile — botão é parte de bloco que provavelmente quebra <360px | 🟡 Médio |
| 7 | `try/catch` engole o erro real — usuário só vê "Erro ao solicitar aula" | 🟡 Médio |

---

## 4. AUDITORIA PEDAGÓGICA

**Conclusão**: ❌ **O sistema NÃO estrutura aulas pedagogicamente.** O Tutor IA não é chamado para gerar título, resumo, capítulos, objetivos, perguntas ou pegadinhas. Tudo isso fica como string JSON cru no `structured_content`.

### Campos esperados vs entregues
| Campo esperado | Estado |
|---|---|
| Título | ⚠️ Genérico: `"Aula Personalizada: ${topic}"` |
| Resumo | ❌ Não gerado |
| Explicação leiga | ❌ Não gerado |
| Explicação técnica | ❌ Não gerado |
| Tópicos | ⚠️ Apenas `topic` + `subtopic` strings |
| Capítulos | ❌ Não gerado |
| Objetivos de aprendizado | ❌ Não gerado |
| Perguntas | ❌ Não gerado |
| Pegadinhas | ❌ Não gerado |
| Recomendações | ❌ Não gerado |
| Referências (Nelson, Sabiston) | ❌ Não injetadas — viola Core Memory |
| Pontos de prova | ❌ Não gerado |

**Recomendação obrigatória:** criar edge function `tutor-lesson-structure` que recebe `sessionId` + `topic`, lê histórico real do Tutor (`tutor_sessions`, `tutor_messages`), e produz JSON estruturado validado contra schema Zod.

---

## 5. AUDITORIA DA TABELA `tutor_lesson_memory`

### Schema (✅ campos presentes)
- `id`, `user_id`, `title`, `subtitle`, `subject`, `topic`, `subtopic`
- `status` (9 valores no CHECK), `priority` (4 valores)
- `structured_content` jsonb
- `video_url`, `thumbnail_url`, `duration`
- `source_session_id`, `teacher_id`
- Soft delete: `deleted_at`, `deleted_by`, `delete_reason`, `hidden_from_student`, `hard_deleted`
- Flags: `is_favorite`, `is_recommended`
- Timestamps: `created_at`, `updated_at`, `published_at`

### Problemas
| # | Problema | Severidade |
|---|---|---|
| 1 | **RLS usa `profiles.role`** (admin/professor/ceo) em vez de `has_role(uid, 'admin')` — viola padrão do projeto e expõe escalada via UPDATE em `profiles` | 🔴 Crítico |
| 2 | Status `'deleted'` no CHECK + coluna `deleted_at` separada — duas fontes de verdade para "deletado" | 🟠 Alto |
| 3 | Status `'unpublished'` existe mas **nenhum código usa** — morto | 🟡 Médio |
| 4 | Sem índice em `(user_id, status)` — query do aluno faz seq-scan quando crescer | 🟡 Médio |
| 5 | Sem índice em `published_at` — listagem cronológica vai degradar | 🟡 Médio |
| 6 | Sem índice em `(deleted_at)` parcial para purge | 🟡 Médio |
| 7 | Faltam colunas previstas: `notebooklm_export_url`, `notebooklm_exported_at`, `video_provider` (mp4/hls/youtube), `transcript_url`, `quality_review_score` | 🟠 Alto |
| 8 | `duration` é `integer` default 0 — sem unidade explícita (segundos? minutos?) | 🟡 Médio |
| 9 | Sem unique constraint em `(user_id, source_session_id, topic)` — gera duplicatas | 🟡 Médio |
| 10 | Trigger `tr_tutor_lesson_memory_updated_at` usa `handle_updated_at` — verificar se função existe | ⚪ Info |

---

## 6. AUDITORIA DA BIBLIOTECA DO ALUNO (`/dashboard/minhas-aulas`)

**Arquivo**: `src/pages/MyLessonsPage.tsx` (234 linhas)

### Problemas
| # | Problema | Severidade |
|---|---|---|
| 1 | `VideoLessonsLibrary = MyLessonsPage` (alias em `App.tsx:123`) — **duas rotas para a mesma página**, confunde mental model | 🟠 Alto |
| 2 | `useEducationalMemory` carrega TODAS as aulas do usuário sem paginação | 🟠 Alto |
| 3 | Filtros (Continuar / Favoritas / Em Produção / Outras) são **todos client-side** com 4 `.filter()` no mesmo array | 🟡 Médio |
| 4 | `LessonCard` re-renderiza inteiro a cada mudança no array (sem `memo`) | 🟡 Médio |
| 5 | **Sem busca, sem filtro por disciplina, sem ordenação** apesar do imports (`Search`, `Filter` importados mas não usados) | 🟠 Alto |
| 6 | `progress` lido como `lesson.progress?.[0]` — nested array de PostgREST não tipado | 🟡 Médio |
| 7 | `getSourceLabel('cme')` ainda retorna `"CME"` — termo técnico exposto ao aluno | 🟡 Médio |
| 8 | Empty state diz: *"gere uma aula CME"* — viola memória `dashboard-nomenclatura-intocavel` e o novo modelo | 🔴 Crítico (UX) |
| 9 | Sem fallback para aulas com `video_url` quebrado / signed-URL expirado | 🟠 Alto |
| 10 | `difficulty_level: 'Médio'` é **hardcoded** no mapper, não vem do banco | 🟡 Médio |
| 11 | Mobile: grid `xl:grid-cols-5` está OK, mas header `text-4xl` e `pt-24` quebra em <380px | 🟡 Médio |

---

## 7. AUDITORIA DO PLAYER

**Arquivo**: `src/pages/VideoLessonPlayer.tsx` (1064 linhas — **gigante**)

### Problemas
| # | Problema | Severidade |
|---|---|---|
| 1 | Tenta `tutor_lesson_memory` primeiro e fallback para `ai_video_lessons` — **dois schemas, dois fluxos**, comportamento imprevisível | 🔴 Crítico |
| 2 | `cme_playback_audit_logs` é gravado mesmo para aulas humanas curadas | 🟠 Alto |
| 3 | URL pública direta (`video_url`) — **sem signed URL**. Qualquer pessoa com a URL assiste sem login | 🔴 Crítico |
| 4 | `progress` (`updateLessonProgress`) **não é chamado** pelo player — progresso nunca persiste | 🔴 Crítico |
| 5 | `useCinematicEngine` + `useNeuroanalytics` + `useAdaptiveEngine` são chamados mesmo para aulas humanas — overhead inútil | 🟡 Médio |
| 6 | 1064 linhas em um único componente — impossível manter | 🟠 Alto |
| 7 | `hls_manifest_url`, `hls_url`, `playback_url` no schema do player mas **não existem** em `tutor_lesson_memory` | 🟡 Médio |
| 8 | Sem retomada (resume from last_position) | 🟠 Alto |
| 9 | Sem watch-time agregado | 🟡 Médio |
| 10 | Sem detecção de completion (>90% assistido) | 🟠 Alto |

---

## 8. AUDITORIA DA UI ADMIN (`/admin/lessons-memory`)

**Arquivo**: `src/pages/admin/AdminLessonsMemory.tsx` (278 linhas)

### Problemas
| # | Problema | Severidade |
|---|---|---|
| 1 | **Upload publica automaticamente** (`status=published, published_at=now()`) — sem revisão manual, sem checklist | 🔴 Crítico |
| 2 | **`Progress value={45}` é hardcoded** — não reflete upload real | 🟠 Alto |
| 3 | Sem confirmação antes de substituir vídeo existente (`upsert: true`) | 🟠 Alto |
| 4 | Sem botão de exclusão / arquivar / rejeitar | 🟠 Alto |
| 5 | Sem filtros por status / data / disciplina | 🟡 Médio |
| 6 | "Exportar para NotebookLM" gera `.txt` com `JSON.stringify` cru — **não é PDF, não tem estrutura, inútil para NotebookLM** | 🔴 Crítico |
| 7 | Nenhuma observabilidade: zero log no `tutor_lesson_events` ao publicar/falhar | 🟠 Alto |
| 8 | Lista não paginada — vai degradar acima de ~500 aulas | 🟡 Médio |
| 9 | Layout só funciona em desktop — flex `md:flex-row` quebra em mobile | 🟡 Médio |
| 10 | Botão "Assistir Prévia" abre `window.open(video_url)` — URL pública, viola signed-URL | 🟠 Alto |
| 11 | "Substituir Vídeo" usa `upsert: true` mas mantém `id+UUID` no fileName — **gera arquivos órfãos infinitamente** no bucket | 🟠 Alto |

---

## 9. AUDITORIA DE EXPORTAÇÃO NOTEBOOKLM

**Verdict**: ❌ **A funcionalidade não existe. É placeholder.**

Código real:
```ts
const content = `AULA: ...\nDATA: ...\nCONTEÚDO PARA NOTEBOOK LM:\n${JSON.stringify(lesson.structured_content, null, 2)}`;
const blob = new Blob([content], { type: 'text/plain' });
```

### Falhas
- ❌ Não é PDF (é `.txt`)
- ❌ Sem capítulos
- ❌ Sem prompts para Gemini
- ❌ Sem estrutura pedagógica
- ❌ Sem títulos, sem hierarquia
- ❌ Toast diz "Conteúdo exportado para NotebookLM" — mensagem enganosa

**Recomendação**: criar edge function `lesson-export-notebooklm` que usa `jsPDF` ou `pdfkit` e produz PDF com:
- Capa (título, disciplina, data)
- Sumário
- Capítulos numerados a partir de `structured_content.chapters[]`
- Caixa "prompt sugerido para Gemini" no final de cada capítulo
- Referências bibliográficas (Nelson, Sabiston)

---

## 10. AUDITORIA DE STORAGE (`tutor-lesson-videos`)

| Campo | Valor atual | Recomendado |
|---|---|---|
| `public` | **`true`** 🔴 | `false` |
| `file_size_limit` | **null** 🔴 | `1073741824` (1GB) |
| `allowed_mime_types` | **null** 🔴 | `{video/mp4, video/webm, application/x-mpegURL}` |

### Policies analisadas
| Policy | Problema |
|---|---|
| `Public Access for tutor videos` (SELECT) | 🔴 Permite QUALQUER pessoa ver QUALQUER vídeo via URL pública — sem RLS de visibilidade |
| `Authenticated users can upload tutor videos` (INSERT) | 🔴 Qualquer aluno autenticado pode subir vídeo |
| `Authenticated users can delete tutor videos` (DELETE) | 🔴 Qualquer aluno pode DELETAR vídeo de outro |
| `Authenticated users can update/delete tutor videos` (UPDATE) | 🔴 Idem |
| `Admins can upload videos` (INSERT) | Redundante (aluno já pode) |
| `Students can read videos` (SELECT) | Redundante (público já permite) |

**Recomendação imediata**:
1. `UPDATE storage.buckets SET public=false, file_size_limit=1073741824, allowed_mime_types=ARRAY['video/mp4','video/webm','application/x-mpegURL'] WHERE id='tutor-lesson-videos';`
2. Dropar todas as 4 policies inseguras.
3. Criar:
   - SELECT: somente owner OU lesson `published` E lesson `user_id = auth.uid()`.
   - INSERT/UPDATE/DELETE: somente `has_role(auth.uid(), 'admin')`.
4. Trocar `getPublicUrl()` por `createSignedUrl()` no player e no admin.
5. Limpar arquivos órfãos (cron mensal).

---

## 11. AUDITORIA DE EXCLUSÃO

| Capacidade | Schema | UI | Status |
|---|---|---|---|
| Soft delete | ✅ `deleted_at`, `deleted_by`, `delete_reason` | ❌ Sem botão | Inerte |
| Hard delete | ✅ `hard_deleted` flag | ❌ Sem botão | Inerte |
| Restauração | ✅ Schema permite | ❌ Sem UI | Inerte |
| Auditoria | ⚠️ `tutor_lesson_events` existe | ❌ Sem evento `lesson_deleted` / `lesson_restored` | Inerte |
| Limpeza de storage | ❌ Sem trigger / cron | — | Vazamento |
| Impacto em progresso | ⚠️ FK `ON DELETE CASCADE` em `tutor_lesson_progress` | — | Hard delete apaga progresso silenciosamente |

---

## 12. AUDITORIA DE OBSERVABILIDADE

### Eventos esperados vs reais
| Evento | Esperado | Real |
|---|---|---|
| `lesson_requested` | ✅ | ✅ Emitido em `useEducationalMemory.ts:110` |
| `lesson_structured` | ✅ | ❌ |
| `lesson_exported` | ✅ | ❌ |
| `lesson_uploaded` | ✅ | ❌ |
| `lesson_published` | ✅ | ❌ |
| `lesson_watched` | ✅ | ❌ |
| `lesson_completed` | ✅ | ❌ |
| `lesson_deleted` | ✅ | ❌ |
| `lesson_restored` | ✅ | ❌ |

**Cobertura: 1 / 9 = 11%.**

`tutor_lesson_events` não tem RLS habilitada (verificar: o output do `\d` mostrou *Policies (row security enabled): (none)* sob a tabela). Isso significa que ou RLS está desabilitada, ou está habilitada sem policies — em ambos os casos é **inseguro**.

---

## 13. INTEGRAÇÃO FSRS / ERROR BANK

**Status**: ❌ **Inexistente.**

- Nenhum hook FSRS é chamado quando aula é completada.
- `useEducationalMemory` não importa nada de `useFsrs`.
- Error Bank não recebe sinal de "aluno assistiu mas errou pós-quiz".
- `is_recommended` existe na tabela mas **nada o calcula**.
- Watch time não influencia `priority` em outros engines.

---

## 14. SEGURANÇA — RESUMO CONSOLIDADO

| # | Vulnerabilidade | Severidade | Arquivo |
|---|---|---|---|
| S1 | RLS de `tutor_lesson_memory` usa `profiles.role` em vez de `has_role()` — escalada via UPDATE em profiles | 🔴 Crítico | migration original |
| S2 | Bucket `tutor-lesson-videos` é público sem MIME nem tamanho | 🔴 Crítico | storage |
| S3 | Qualquer authenticated pode UPLOAD/DELETE em qualquer pasta do bucket | 🔴 Crítico | storage policies |
| S4 | `getPublicUrl()` no player → URLs vazam, nunca expiram | 🔴 Crítico | `VideoLessonPlayer`, `AdminLessonsMemory` |
| S5 | `tutor_lesson_events` sem RLS (ou sem policies) | 🟠 Alto | migration |
| S6 | Sem rate-limit em `requestLesson` — DoS trivial | 🟠 Alto | `useEducationalMemory:80` |
| S7 | `structured_content` jsonb sem schema validado — pode receber payload arbitrário | 🟡 Médio | mesmo |
| S8 | Sem validação de tamanho/MIME de upload no cliente (só `startsWith('video/')`) | 🟡 Médio | `AdminLessonsMemory:91` |

---

## 15. PERFORMANCE

- `useEducationalMemory` faz `select *` + nested `tutor_lesson_progress` sem `.limit()` → **eventual N+1 implícito quando crescer**.
- Sem paginação em `/minhas-aulas` nem em `/admin/lessons-memory`.
- `VideoLessonPlayer` carrega 7 hooks pesados (`useAdaptiveEngine`, `useNeuroanalytics`, `useCinematicEngine`, `useTelemetry`, `useVideoSegmentEvents`, `useVideoSegmentAnalytics`, `useTutorTemporalContext`) **mesmo para aulas curadas humanas que não precisam disso**.
- Bundle: `VideoLessonPlayer.tsx` tem 1064 linhas + dependências cinematográficas → split obrigatório.

---

## 16. UX

**Pergunta**: *"Um professor/admin comum entenderia esse fluxo sem treinamento técnico?"*
**Resposta**: ❌ **Não.**

Razões:
- Upload publica direto, sem etapa de revisão.
- "Exportar NotebookLM" promete PDF, entrega `.txt`.
- Botão "Substituir Vídeo" sem confirmação.
- Sem indicação visual do estado da aula (apenas badge crua com `status` em snake_case).
- Empty state ainda fala em "CME".
- Mensagens de erro genéricas ("Falha no upload: <stack>").

---

## 17. CÓDIGO — ITENS PARA LIMPEZA

| Item | Tipo | Ação |
|---|---|---|
| `VideoLessonsLibrary = MyLessonsPage` (`App.tsx:123`) | Alias morto | Remover, usar única rota |
| `getSourceLabel('cme')` → `"CME"` | Termo técnico vazado | Renomear para "Aula" |
| `useTutorCME` em `TutorMessageItem` | Acoplamento legado | Isolar atrás de feature flag |
| `cme_playback_audit_logs.insert()` para aulas humanas | Telemetria mista | Separar tabela `tutor_lesson_playback_audit` |
| Imports `Search`, `Filter` em `MyLessonsPage` não usados | Dead code | Remover ou implementar |
| `LessonData` interface em `VideoLessonPlayer` mistura campos CME e Tutor | Tipo inconsistente | Discriminated union (`{kind: 'cme'} \| {kind: 'tutor'}`) |
| `difficulty_level: 'Médio'` hardcoded | Mock visível | Adicionar coluna ou remover do UI |
| 4 edge functions CME ativas mas não usadas no fluxo novo | Edge functions zumbis | Marcar deprecated, remover na Fase 4 |

---

## 18. PROBLEMAS POR SEVERIDADE

### 🔴 Críticos (8)
1. RLS via `profiles.role` (escalada de privilégio).
2. Bucket público sem MIME nem limite.
3. Storage policies de upload/delete sem owner.
4. URLs públicas em vez de signed URLs.
5. Upload publica direto, sem revisão.
6. Estruturação pedagógica IA inexistente.
7. Player tenta dois schemas (CME + Tutor) — comportamento imprevisível.
8. Progresso nunca persistido no player.

### 🟠 Altos (15)
- Exportação NotebookLM falsa.
- `tutor_lesson_events` sem RLS / 1 evento de 9.
- Sem rate-limit em request.
- Sem deduplicação de pedidos.
- Sem fluxo de exclusão/restauração na UI.
- Sem retomada de vídeo.
- Sem detecção de conclusão.
- Sem integração FSRS / Error Bank.
- Bibliografia Nelson/Sabiston não injetada (viola Core Memory).
- Cards quebrados sem fallback de vídeo.
- VideoLessonPlayer monolítico (1064 LOC).
- Substituir vídeo cria órfãos infinitos.
- Empty state fala em "CME".
- Lista admin sem filtros / paginação.
- Camada cinematográfica carregada para aulas humanas.

### 🟡 Médios (12)
- Múltiplas duplicidades (alias `VideoLessonsLibrary`, `tutor_lesson_memory` / `ai_video_lessons`).
- Schema com status mortos (`unpublished`).
- Falta de índices `(user_id,status)`, `published_at`.
- `difficulty_level` hardcoded.
- Mobile do admin quebrado.
- Tipos `LessonData` inconsistentes.
- Sem validação de payload no cliente.
- Toast genérico de erro.
- Alvo de hooks pesados no player.
- Contexto da sessão original não capturado.
- Imports não usados.
- `duration` sem unidade explícita.

---

## 19. ROADMAP DE MATURIDADE ENTERPRISE

### Fase 1 — Correções Críticas (1–2 sprints) 🔴
1. **Refazer RLS** de `tutor_lesson_memory` usando `has_role()`. Migration obrigatória.
2. **Privatizar bucket** `tutor-lesson-videos` + recriar policies por owner.
3. **Trocar `getPublicUrl` por `createSignedUrl`** em player e admin.
4. **Habilitar RLS** em `tutor_lesson_events` com policies por owner / admin.
5. **Edge function `lesson-request`** com rate-limit (1 request/min/usuário) + dedup.
6. **Separar status `pending_publication`** do upload — exigir botão explícito de publicar.
7. **Adicionar `tutor_lesson_progress.update`** no player a cada 5s.

### Fase 2 — Hardening (2–3 sprints) 🟠
1. Edge function `tutor-lesson-structure`: chama LLM, valida com Zod, popula `structured_content` real.
2. Edge function `lesson-export-notebooklm`: gera PDF com `pdf-lib`, capítulos, prompts, referências.
3. Emitir 9 eventos completos (`structured/exported/uploaded/published/watched/completed/deleted/restored`).
4. UI de exclusão / restauração no admin com confirmação dupla.
5. Cron `lesson-storage-cleanup` para arquivos órfãos.
6. Discriminated union `LessonData` (`tutor` | `cme_legacy`).
7. Quebrar `VideoLessonPlayer` em <300 LOC + subcomponentes.

### Fase 3 — UX Enterprise (2 sprints) 🟢
1. Filtros + busca server-side em `/minhas-aulas` e `/admin/lessons-memory`.
2. Paginação cursor-based.
3. Empty state e mensagens em pt-BR humano (sem "CME").
4. Mobile-first: redesign do admin para drawer + cards verticais.
5. Indicador real de progresso de upload (`xhr.upload.onprogress`).
6. Player com retomada (`last_position`), watch-time agregado, completion automática.

### Fase 4 — Escalabilidade 🟢
1. Mover `cme-orchestrator/dev-worker/start-pipeline/status` para `_archive/` ou flag de feature.
2. Separar `tutor_lesson_playback_audit` de `cme_playback_audit_logs`.
3. CDN para `tutor-lesson-videos` (CloudFront / Bunny) + HLS opcional.
4. Índice composto `(user_id, status, published_at desc)` + materialized view de "minha biblioteca".

### Fase 5 — Inteligência Pedagógica 🚀
1. **FSRS hookup**: ao concluir aula, criar revisões dos `objectives` no `tutor_lesson_memory.structured_content`.
2. **Error Bank**: pós-quiz da aula → registra erros com `topic`/`subtopic`.
3. **Recomendação**: motor `is_recommended` baseado em proficiência + atrito por especialidade.
4. **Smart Planner**: aulas pendentes entram como tarefas com peso adaptativo.
5. **Tutor IA**: ao retomar sessão da aula, injeta contexto da `structured_content`.

---

## 20. RESPOSTA À PERGUNTA CENTRAL

> *"O sistema realmente está pronto para uso real ou apenas aparenta estar funcionando?"*

**Apenas aparenta.** O caminho feliz foi codificado: aluno clica → linha entra na tabela → admin sobe vídeo → aluno assiste. Mas:

- **Em produção, o fluxo nunca rodou** (0 linhas em `tutor_lesson_memory`).
- **Tem 8 vulnerabilidades críticas** abertas.
- **A "estruturação pedagógica" é mentira** — só copia o prompt original.
- **A "exportação NotebookLM" é mentira** — gera `.txt` cru.
- **Progresso, FSRS, Error Bank, observabilidade** são todos inexistentes ou mockados.
- **Ainda depende do CME** em pelo menos 6 pontos críticos do código.

Para chegar a "pronto para produção real", a **Fase 1** é obrigatória e bloqueante. As Fases 2–3 são necessárias para que professores/admins não-técnicos consigam operar sem treinamento. As Fases 4–5 são o que diferencia o sistema enterprise.

---

## 21. PRÓXIMA AÇÃO RECOMENDADA

Antes de qualquer implementação, **confirmar com o usuário a prioridade** entre:
- **(a) Segurança primeiro** → Fase 1 inteira (RLS + storage + signed URLs).
- **(b) Pedagogia primeiro** → Edge function `tutor-lesson-structure` + exportação real.
- **(c) UX primeiro** → admin enterprise (filtros, exclusão, observabilidade).

A recomendação técnica é **(a) primeiro**, depois **(b)**, depois **(c)**. Sem (a), abrir o sistema para alunos reais é risco de incidente de segurança.
