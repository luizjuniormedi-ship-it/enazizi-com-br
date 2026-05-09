# Storage Security Report — Fechamento Final

## Buckets (7 total — auditoria disse "6 públicos", real eram 3)

| Bucket | public flag | Mantido? |
|--------|-------------|----------|
| `avatars` | true | ✅ legítimo (avatares de usuário) |
| `question-images` | true | ✅ legítimo (imagens de questões servidas no app) |
| `video-lessons` | true | ✅ leitura pública (alunos assistem); upload **agora** restrito a admin/professor |
| `ai_production_materials` | false | ✅ |
| `cme-references` | false | ✅ + RLS endurecida (admin/professor) |
| `tutor-lesson-videos` | false | ✅ + RLS endurecida (apenas staff) |
| `user-uploads` | false | ✅ scoped por `auth.uid()` no path |

## Policies removidas (perigosas)

| Policy removida | Bucket | Risco |
|-----------------|--------|-------|
| `Public Access for tutor videos` | tutor-lesson-videos | Vídeos privados eram **lidos por qualquer um** |
| `Authenticated users can upload tutor videos` | tutor-lesson-videos | Qualquer authenticated subia vídeo |
| `Authenticated users can update/delete tutor videos` | tutor-lesson-videos | Qualquer authenticated apagava vídeo |
| `Authenticated users can delete tutor videos` | tutor-lesson-videos | idem |
| `Admins can read references` | cme-references | Sem checagem de role real |
| `Admins can upload references` | cme-references | idem |
| `Auth upload video-lessons` | video-lessons | Qualquer authenticated subia aula |

## Policies novas
- `staff_read_cme_references` / `staff_upload_cme_references` → `has_role(admin|professor)`
- `staff_upload_video_lessons` → `has_role(admin|professor)`
- `tutor_lesson_videos_staff_*` (já existiam) cobrem leitura/escrita controlada

## Não alterado
- Acesso público de leitura a `avatars`, `question-images`, `video-lessons` (intencional para alunos).
- Uploads de avatar/`user-uploads` continuam scoped por `auth.uid()::text = (storage.foldername(name))[1]`.
