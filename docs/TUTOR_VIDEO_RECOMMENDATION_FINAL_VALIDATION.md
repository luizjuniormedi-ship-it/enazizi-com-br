# Validação Final — Recomendação de Videoaulas no Tutor IA

## 1. Banco de aulas (estado real)

| Fonte | Publicadas | Com vídeo |
|---|---|---|
| `ai_video_lessons` | 1 | 1 |
| `tutor_lesson_memory` | 3 | 3 |

Aulas publicadas confirmadas:
- **Pericardite vs. Endocardite (Cardiologia)** — `ecbc0daf-657a-4df5-884d-fbe7354e2927` ✅
- Insuficiência Cardíaca — `b9be18bb-9fe9-4bfa-b88a-27f2cf90b22c`
- Imunização no Adolescente — `a6363195-d116-4588-85e8-1319375e3c4f`
- Cirrose (ai_video_lessons) — `9f3b5ae4-0a5f-4490-825a-f76a5d410374`

## 2. Correções aplicadas em `tutorVideoRecommendationService.ts`

- **Bug 1:** sigla `fa` casava com "Falência" (substring). Corrigido com `termMatches` que aplica `\b...\b` para termos ≤3 caracteres.
- **Bug 2:** sinônimos encadeados (cardiologia → fa → cardiologia) inflavam falsos positivos. Removido encadeamento transitivo; cada termo expande apenas seus sinônimos diretos.
- Filtra `status='published'` em ambas as fontes e descarta aulas sem `video_url` válido (registra `skipped_no_video`).
- Defesa-em-profundidade: rejeita não-publicadas mesmo se vierem da query (`skipped_unpublished`).

## 3. Eventos de log (`logVideoRecommendationEvent`)

`search_started`, `found`, `not_found`, `shown`, `clicked`, `skipped_unpublished`, `skipped_no_video` — todos emitidos pelo serviço (`search_started`/`found`/`not_found`/`skipped_*`) e pelo `TutorMessageItem` (`shown` ao renderizar card, `clicked` em ambos os botões, com `location`).

## 4. Tutor (UI)

- Card ENAFLIX renderizado **no topo da resposta do assistente** quando há `lessonData`.
- Botões "Abrir Aula Completa" navegam **sempre** para `/dashboard/videoaulas/:id` (player interno) — URL direta do vídeo nunca é exposta.
- Sem aula → card não aparece (`lessonData` é `null`).
- Não duplica: `useEffect` busca apenas por `id` da mensagem ou `topic`; `setLessonData` registra um único objeto.

## 5. Segurança

- Consultas usam o cliente Supabase do usuário ⇒ RLS aplicado.
- Filtro de `status='published'` + `deleted_at IS NULL` no SELECT.
- Player interno garante autorização e signed URLs.

## 6. Testes manuais (esperado pós-fix)

| Pergunta | Resultado esperado |
|---|---|
| "me explica pericardite" | Card → Pericardite vs. Endocardite |
| "me explica FA" | Sem aula publicada de FA → card oculto |
| "pneumonia" | Sem aula → card oculto |
| Aula sem vídeo | `skipped_no_video` no console, ignorada |
| Aula não publicada | Filtrada na query e por defesa-em-profundidade |
| Tema inexistente | `not_found`, card oculto |

## 7. Próximos passos sugeridos

- Persistir `logVideoRecommendationEvent` em `telemetry_events` para análise agregada.
- Adicionar mais aulas publicadas para cobrir Pneumonia/FA isoladamente.
