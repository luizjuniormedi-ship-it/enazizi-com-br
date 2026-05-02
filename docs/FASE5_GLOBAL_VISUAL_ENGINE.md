# FASE 5 — ENAFLIX Global Visual Engine

> Camada visual mestre, **aditiva** e **não invasiva**, para toda a plataforma ENAZIZI/ENAFLIX/CONCURFLIX.
> Nenhum backend, RLS, edge function, hook ou contrato foi alterado.

## Objetivo

Substituir o padrão "CSS por tela" por uma **engine visual global** com tokens, classes utilitárias e componentes reutilizáveis no padrão **Pixar Medical 3D Cinematic**.

---

## 1. Design Tokens globais

Arquivo: `src/styles/enaflix-tokens.css` (importado em `src/main.tsx` logo após `index.css`).

### Cores
`--enaflix-bg`, `--enaflix-bg-soft`, `--enaflix-surface`, `--enaflix-surface-2`, `--enaflix-surface-3`, `--enaflix-violet`, `--enaflix-cyan`, `--enaflix-mint`, `--enaflix-medical-blue`, `--enaflix-danger`, `--enaflix-warning`, `--enaflix-success`.

### Glows
`--glow-violet`, `--glow-cyan`, `--glow-medical`, `--glow-success`, `--glow-danger`.

### Shadows
`--shadow-pixar`, `--shadow-cinematic`, `--shadow-soft`, `--shadow-medical`.

### Radii
`--radius-pixar` (28px), `--radius-card` (22px), `--radius-button` (999px), `--radius-overlay` (18px).

### Motion
`--ease-cinematic`, `--ease-pixar`, `--duration-fast`, `--duration-normal`, `--duration-slow`.

### Gradientes cinematográficos
`--enaflix-grad-violet`, `--enaflix-grad-cyan`, `--enaflix-grad-mint`, `--enaflix-grad-danger`, `--enaflix-grad-medical`.

### Utility classes
- `.enaflix-text-holo` — título holográfico tri-color
- `.enaflix-hud-label` — micro-label cinematográfica
- `.enaflix-section-title` — título de seção com barra holográfica
- `.enaflix-glass` — glassmorphism premium
- `.enaflix-float`, `.enaflix-holo-pulse`, `.pixar-breathe` — animações GPU

Compatível com `prefers-reduced-motion`.

---

## 2. Componentes globais (`src/components/enaflix/engine.ts`)

| Componente | Arquivo | Variantes / Propósito |
|---|---|---|
| `Enaflix3DButton` | `Enaflix3DButton.tsx` | `primary`, `violet`, `cyan`, `mint`, `danger`, `ghost`, `outline` · sizes `sm/md/lg` · `glow`, `loading`, `iconLeft`, `iconRight` |
| `EnaflixCinematicCard` | `EnaflixCinematicCard.tsx` | `poster`, `lesson`, `dashboard`, `analytics`, `exam`, `tutor`, `medical` |
| `EnaflixBackgroundFX` | `EnaflixBackgroundFX.tsx` | grid médico + partículas flutuantes + holographic orbs · `subtle/medium/intense` |
| `EnaflixTutorHUD` | `EnaflixTutorHUD.tsx` | invólucro holográfico para Tutor IA com status `idle/thinking/speaking` |
| `EnaflixPlayerOverlay` | `EnaflixPlayerOverlay.tsx` | overlay cinematográfico para player de aula com timeline holográfica |
| `EnaflixModal` | `EnaflixModal.tsx` | dialog Pixar Glass (md/lg/xl/full) |
| `EnaflixLoader` | `EnaflixLoader.tsx` | `default` (anel cinético), `hologram` (cruz médica), `dots` |
| `EnaflixSectionTitle` | `EnaflixSectionTitle.tsx` | título cinematográfico com kicker, subtítulo e action |
| `EnaflixBadge` | `EnaflixBadge.tsx` (existente) | AI, urgente, novo, revisão, premium, concluído |
| `EnaflixPosterRow` (alias) | `EnaflixRow.tsx` | row horizontal estilo Netflix |

Todos os componentes:
- `React.memo` onde aplicável
- transições apenas em `transform/opacity/filter`
- compatíveis com SSR/lazy

---

## 3. Migração progressiva (compatibilidade total)

A engine **convive** com:
- `EnaflixButton` (botão circular ENAFLIX da topbar)
- `EnaflixCard`, `EnaflixActionCard`, `EnaflixModuleCard`
- classes `.btn-pixar*`, `.card-pixar*`, `.pixar-breathe` já presentes em `index.css`

Recomendação:
- Páginas novas → usar diretamente `engine.ts`
- Páginas legadas → migrar gradualmente, sem breaking change

---

## 4. Performance

- GPU-only: `transform`, `opacity`, `filter`
- `React.memo` em todos os componentes pesados
- `EnaflixBackgroundFX` usa apenas elementos absolute/fixed e máscaras CSS
- Partículas geradas estaticamente (sem JS de animação)
- Respeita `prefers-reduced-motion`

---

## 5. Não alterado

- ✅ Backend / Supabase / Edge Functions
- ✅ RLS, hooks, queries, contratos, schema
- ✅ Fluxos da Fase 1 (segurança) e Fase 2 (estrutura pedagógica)
- ✅ CME (continua oculto, mas funcional)

---

## 6. Próximos passos sugeridos

1. Substituir botões legados por `Enaflix3DButton` em telas de Tutor, Memória de Aulas e Player
2. Aplicar `EnaflixBackgroundFX` no layout do dashboard e Tutor
3. Migrar modais críticos para `EnaflixModal`
4. Documentar guidelines visuais em Storybook (futuro)
