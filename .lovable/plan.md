## Problema

A tela `/admin/lessons-memory` (`src/pages/admin/AdminLessonsMemory.tsx`) está com cores hardcoded em tom claro (`bg-slate-50`, `text-slate-700`, `border-slate-200`), mas o app roda em tema escuro. Os botões `outline` herdam `bg-background/40` (escuro) com classes extras `text-emerald-700`/`text-slate-200` que somem no fundo escuro — daí ficam ilegíveis.

## Correção

Substituir as cores hardcoded por tokens semânticos do design system para funcionar em ambos os temas, e garantir contraste forte nos botões.

### Mudanças em `src/pages/admin/AdminLessonsMemory.tsx`

1. **Container e header** — trocar:
   - `bg-slate-50` → `bg-background`
   - `bg-white border-b` → `bg-card border-b border-border`
   - `text-slate-900` → `text-foreground`
   - `text-slate-500` → `text-muted-foreground`
   - `bg-slate-50 border-slate-200` (input) → `bg-muted border-border`

2. **Cards de aulas** — trocar:
   - `bg-white` → `bg-card`
   - `text-slate-800/700/500/400` → `text-foreground` / `text-muted-foreground`
   - `border-slate-200` → `border-border`
   - `bg-slate-50/50 border-l` (painel direito) → `bg-muted/40 border-l border-border`
   - `bg-slate-200 animate-pulse` (skeleton) → `bg-muted animate-pulse`

3. **Botões (linhas 405–503)** — garantir contraste:
   - Botão "Ver player": manter `variant="outline"` mas trocar `border-emerald-300 text-emerald-700 hover:bg-emerald-50` → `border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400`
   - Botões export (NotebookLM/Gemini/Vids/Markdown): `border-slate-200` → `border-border text-foreground hover:bg-muted`
   - Botão "Reestruturar IA": `text-primary hover:bg-primary/5` → manter, garantir variant `ghost` com `text-primary`
   - Botão "Publicar": já tem `bg-emerald-600` ok, mas trocar `disabled:bg-slate-300` → `disabled:bg-muted disabled:text-muted-foreground`
   - Quando `!hasVideo`: `bg-amber-600 hover:bg-amber-700` → manter (já contrasta) e adicionar `text-white`

4. **Status badges (linhas 49–57)** — aumentar opacidade do fundo para legibilidade no dark:
   - `bg-X-500/10 text-X-700` → `bg-X-500/20 text-X-300` (para azul/laranja/âmbar/vermelho/slate)
   - `published`: manter `bg-emerald-500 text-white`

5. **Estado vazio e progresso** — trocar `bg-white`, `border-slate-200`, `bg-amber-100`, `text-amber-600` por equivalentes com tokens (`bg-card`, `border-border`, `bg-amber-500/20`, `text-amber-400`).

## Resultado

Todos os textos e botões ficam legíveis no tema escuro (e continuam funcionando no claro), sem mudar layout, lógica ou rotas.
