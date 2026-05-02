## Fase 3 — Redesign Cinematográfico ENAFLIX (UX/UI)

Apenas camada visual. Toda lógica (queries, mutations, edge functions, RLS, signed URLs, checklist backend, telemetria) permanece idêntica.

### Escopo de telas

1. `src/pages/admin/AdminLessonsMemory.tsx` → **Central de Produção ENAFLIX**
2. `src/pages/VideoLessonPlayer.tsx` → **Player Premium estilo Netflix/Disney+**
3. `src/pages/MyLessonsPage.tsx` → **Home ENAFLIX do aluno** (já parcialmente Enaflix; aprofundar)

### Novos componentes (em `src/components/enaflix/admin/`)

- `ProductionHeroHeader.tsx` — hero cinematográfico com gradiente animado, glow, contadores (total / publicadas / em estruturação / aguardando revisão).
- `ProductionTabs.tsx` — tabs horizontais Netflix (Todas / Estruturando / Em revisão / Prontas / Publicadas / Arquivadas) com indicador animado.
- `ProductionFilterBar.tsx` — busca premium + chips de filtro (disciplina, score).
- `LessonProductionCard.tsx` — card cinematográfico (thumbnail grande, gradient overlay, hover zoom, badges com glow, score pedagógico, duração, ações flutuantes).
- `LessonStatusBadge.tsx` — badges premium animados (`structuring`, `pending_review`, `ready_to_publish`, `published`, etc.) com ícone + glow específico.
- `LessonChecklistRing.tsx` — progresso circular + lista visual dos 5 itens do checklist (mantém os mesmos nomes/keys do backend).
- `LessonDetailDrawer.tsx` — drawer lateral (Radix Sheet) com blur, abas internas: Resumo IA, Capítulos, Roteiro, Prompts (Gemini/NotebookLM), Objetivos, Pegadinhas, Flashcards, Quiz, Score.
- `LessonActionsMenu.tsx` — action pills (Reestruturar IA, Exportar NotebookLM/Gemini/Vids/Markdown, Upload vídeo, Preview seguro, Publicar) reaproveitando handlers existentes.
- `LessonThumbnail.tsx` — thumbnail com fallback estilo Pixar/ENAFLIX + skeleton.

### Novos componentes do Player

Em `src/components/enaflix/player/`:
- `CinematicPlayerHero.tsx` — overlay gradient, ambient glow, título cinematográfico.
- `PlayerAutoHideControls.tsx` — controles que somem após inatividade.
- `PlayerProgressBar.tsx` — progress premium com chapters dots.
- `PlayerSidebarChapters.tsx` — sidebar de capítulos.
- `PlayerSidebarMaterials.tsx` — materiais (flashcards, quiz, prompts).

### Home ENAFLIX (aluno)

Reorganizar `MyLessonsPage.tsx` em rows estilo Netflix usando `EnaflixSectionRow` / `EnaflixSectionRowVideo` já existentes:
- Hero banner (aula em destaque)
- Continue Assistindo
- Recomendado para você (placeholder vindo de `useEducationalMemory` ordenado por recência)
- Baseado nos seus erros (filtro existente)
- Revisão FSRS (filtro existente)
- Novas aulas
- Em alta
- Trilhas IA

Sem novas queries — apenas reorganização visual dos dados já carregados.

### Sistema visual

- Tokens: usar variáveis semânticas existentes (`--hue-enaflix`, `glass-premium`, `hero-ambient`, `animate-fade-in`, `hover-scale`).
- Glassmorphism leve (`backdrop-blur-md` + `bg-white/5`).
- Paleta: preto profundo `#0a0a12`, grafite, roxo ENAFLIX, azul neon discreto, vermelho discreto, branco suave — todos via tokens já presentes em `index.css` / `tailwind.config.ts`.
- Animações: Framer Motion (já no projeto) — stagger nos grids, fade/slide nos drawers, hover scale nos cards. Sem exagero.
- Loading: `CinematicSkeleton` + skeleton específico para cards de aula.

### Restrições (NÃO mexer)

- Edge functions, RLS, signed URLs, lógica de publicação, checklist no backend, `tutor_lesson_events`, progress tracking.
- Hooks de dados (`useEducationalMemory`, queries do admin) — apenas consumir.
- Nomes de módulos / sidebar / rotas (memory rule).

### Performance

- `React.memo` em `LessonProductionCard` e cards da home.
- `loading="lazy"` em todas as thumbnails.
- Drawer e abas internas com lazy mount.
- Sem virtualização inicial (volume atual baixo); preparar grid para adicionar depois.

### Entregáveis finais

1. Build + typecheck limpos (rodados pelo harness).
2. Relatório `docs/FASE3_ENAFLIX_VISUAL_REDESIGN.md` listando: telas alteradas, componentes novos, animações, melhorias UX/mobile, performance, status final.

### Diagrama

```text
AdminLessonsMemory
├── ProductionHeroHeader (counters + ambient glow)
├── ProductionTabs (status filter)
├── ProductionFilterBar (search + chips)
└── Grid<LessonProductionCard>
        └── click → LessonDetailDrawer
                     ├── tabs: Resumo / Capítulos / Roteiro / Prompts / Quiz
                     ├── LessonChecklistRing
                     └── LessonActionsMenu
```
