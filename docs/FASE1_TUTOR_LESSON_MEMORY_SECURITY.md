# Fase 1 Bloqueante – Sistema de Memória de Aulas do Tutor
**Data:** 2026-05-02 · **Escopo:** segurança, integridade, fluxo de publicação manual.

---

## 1. RLS – `tutor_lesson_memory`
**Removidas** todas as policies que dependiam de `profiles.role` (vetor de escalação).
**Novas policies via `user_roles` + `has_role()`** (helper `public.is_lesson_staff`):

| Operação | Quem | Restrição |
|---|---|---|
| SELECT | Aluno | só `user_id = auth.uid()` (próprio pedido + publicadas + não ocultas + não deletadas) |
| SELECT | Staff (admin/professor/coordinator/institutional_admin) | tudo |
| INSERT | Aluno | apenas `status='pending_review'`, sem video_url, sem teacher_id, sem published_at |
| INSERT | Staff | livre |
| UPDATE | Staff | livre |
| UPDATE | Aluno | bloqueado em campos administrativos via trigger |
| DELETE | Apenas `admin` | hard delete restrito |

**Trigger `protect_tutor_lesson_admin_fields`:** rejeita qualquer alteração de aluno em `status`, `video_url`, `thumbnail_url`, `published_at`, `teacher_id`, `hidden_from_student`, `hard_deleted`, `deleted_at`, `deleted_by`, `is_recommended`, `priority`, `duration`.

## 2. RLS – `tutor_lesson_progress`
- Aluno só lê/grava o próprio progresso. Staff lê tudo. Sem DELETE.

## 3. RLS – `tutor_lesson_events`
- Staff lê tudo; ator lê o próprio.
- INSERT exige `actor_id = auth.uid()` (sem spoofing).

## 4. Storage – bucket `tutor-lesson-videos`
- `public = false`
- `file_size_limit = 524288000` (500 MB)
- `allowed_mime_types`: mp4, webm, quicktime, mkv, avi
- Policies antigas removidas. Apenas staff pode INSERT/UPDATE/DELETE/SELECT direto.
- Aluno não tem leitura direta — acessa **somente via signed URL**.

## 5. Signed URLs
- Nova edge function **`tutor-lesson-signed-url`** (deployada).
- Valida ownership (staff OU dono de aula publicada), gera URL temporária de 60 min via `createSignedUrl`.
- `AdminLessonsMemory` usa para preview (botão "Preview seguro").
- `VideoLessonPlayer` usa quando `__source === "tutor_memory"`. URL é renovada a cada 50 min.
- `getPublicUrl` foi removido. O `video_url` salvo na tabela agora guarda o **path puro**, não URL pública.

## 6. Fluxo de publicação separado
- Upload → status `ready_to_publish` (não publica mais automaticamente).
- Botão **"Publicar aula"** aparece apenas com `ready_to_publish`.
- Validação antes de publicar: vídeo + título + (subject ou topic) + status válido.
- Só então: `status='published'` + `published_at`.

## 7. Progresso real do aluno
- `handleAction()` agora calcula `progress_percent` e marca `completed=true` ao atingir **≥90%**.
- Persiste `last_position`, `progress_percent`, `completed`, `completed_at`.
- O heartbeat existente (30 s) alimenta automaticamente.

## 8. Observabilidade – `tutor_lesson_events`
Eventos emitidos:
- `lesson_uploaded` (admin)
- `lesson_ready_to_publish` (admin, após upload)
- `lesson_published` (admin)
- `lesson_watched` (aluno, no heartbeat)
- `lesson_completed` (aluno, ao atingir 90%)

CME continua **separado** — `cme_playback_audit_logs` não recebe mais logs de aulas humanas.

## 9. Riscos restantes / Fase 2
1. `structured_content` ainda recebe só o prompt cru; falta agente IA real para chapters/objetivos/refs.
2. Exportação NotebookLM ainda é `.txt`. PDF estruturado não foi feito (escopo Fase 2).
3. Componente `VideoLessonPlayer` (1064+ linhas) ainda mistura código legado de CME — refator pedagógico continua na Fase 2.
4. Rate-limit em `tutor-lesson-signed-url` ainda não implementado (sugestão: bucket por usuário).
5. Linter Supabase mantém 209 alertas pré-existentes (não introduzidos por esta fase).

## 10. Como testar
1. Como aluno: tentar `update` direto em status/video_url → erro pelo trigger.
2. Como aluno: tentar upload no bucket → policy bloqueia.
3. Como aluno: tentar ver aula `pending_review` de outro user → 0 linhas.
4. Como admin: subir vídeo → status vai para `ready_to_publish`, botão de publicar aparece.
5. Como admin: clicar "Publicar aula" → status vira `published`, aluno passa a ver.
6. Como aluno: abrir player → vídeo carrega via signed URL temporária; progresso sobe.

---

**Próximo passo (Fase 2 sugerida):** agente IA real para estruturar conteúdo + export PDF NotebookLM + integração FSRS/Error Bank.
