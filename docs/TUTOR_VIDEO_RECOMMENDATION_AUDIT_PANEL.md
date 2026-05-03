# Auditoria de Recomendações de Videoaulas - Tutor IA

Este documento descreve o sistema de auditoria e telemetria para recomendações automáticas de videoaulas no Tutor IA.

## 1. Arquitetura de Telemetria

As recomendações agora são rastreadas ponta a ponta através da tabela `telemetry_events`.

### Eventos Registrados:
- `tutor_video_search_started`: Disparado quando o Tutor inicia a busca por uma aula para um tópico.
- `tutor_video_found`: Disparado quando uma aula compatível é encontrada (inclui `lesson_id` e `confidence`).
- `tutor_video_not_found`: Disparado quando nenhum conteúdo satisfatório foi encontrado para o tema.
- `tutor_video_shown`: Registrado quando o card de recomendação é efetivamente renderizado para o aluno.
- `tutor_video_clicked`: Registrado quando o aluno clica no botão "Abrir Aula Completa".
- `tutor_video_skipped_unpublished`: Aula encontrada, mas descartada por não estar publicada.
- `tutor_video_skipped_no_video`: Aula encontrada, mas descartada por falta de URL de vídeo válida.

## 2. Painel de Auditoria Admin

Localizado em: `/admin/tutor-video-recommendations`

### Funcionalidades:
- **KPIs em Tempo Real**: Buscas Totais, Taxa de Encontro (Match Rate), Click-Through Rate (CTR).
- **Feed de Eventos**: Log detalhado de todas as interações, permitindo ver quais temas estão sendo buscados e o que está sendo recomendado.
- **Top Temas**: Ranking dos assuntos mais pesquisados pelos alunos no Tutor.
- **Análise de Falsos Positivos**: Identificação de temas com alta demanda mas sem conteúdo correspondente.

## 3. Segurança e Robustez

- **Filtros de Visibilidade**: O sistema garante que apenas aulas com `status = 'published'`, `deleted_at IS NULL` e `hidden_from_student = false` sejam exibidas.
- **Validação de Link**: Aulas sem `playback_url` ou `video_url` válidos são automaticamente filtradas para evitar erros de reprodução.
- **Player Interno**: O sistema utiliza navegação interna para `/dashboard/videoaulas/:id`, mantendo o aluno dentro do ecossistema ENA e respeitando as regras de RLS do Supabase.
- **Word Boundaries**: Termos curtos (ex: "FA") utilizam Regex com word boundaries (`\b`) para evitar matches incorretos (ex: "FA" não casa com "FAlência").

## 4. Testes Automatizados

Foram implementados testes unitários em `src/services/tutorVideoRecommendationService.test.ts` cobrindo:
- Normalização de termos médicos e sinônimos.
- Match de termos curtos com segurança.
- Tratamento de acentuação e normalização NFD.

## 5. Próximos Passos
- Expandir a base de sinônimos conforme feedback dos logs de `not_found`.
- Implementar recomendação baseada em embeddings (vetorial) para maior precisão semântica em temas complexos.
