

## Tooltips descritivos na Sidebar

### O que será feito
Adicionar um tooltip (hover card) em cada item do menu lateral. Ao passar o mouse sobre qualquer módulo, aparece uma breve descrição explicando o que aquele módulo faz.

### Implementação

**1. Adicionar campo `description` ao tipo `NavItem` e a cada item nos `navGroups`**

Cada módulo recebe uma descrição curta, por exemplo:
- Missão do Dia: "Sua tarefa prioritária de estudo baseada no seu desempenho"
- Questões: "Gere e pratique questões adaptativas por tema"
- Flashcards: "Revise conteúdos com repetição espaçada"
- Tutor IA: "Converse com seu professor virtual para tirar dúvidas"
- etc.

**2. Envolver cada link do menu com `Tooltip` do Radix (já existe em `@/components/ui/tooltip`)**

- Usar `TooltipProvider` no nível da sidebar
- Cada `<Link>` fica dentro de `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent side="right">`
- O tooltip aparece à direita da sidebar com a descrição do módulo

**3. Funciona nos dois modos**
- **Modo expandido**: tooltip com descrição aparece ao lado direito
- **Modo compacto (estudo ativo)**: tooltip mostra nome + descrição (já que o label fica oculto)

### Arquivos modificados
- `src/components/layout/DashboardSidebar.tsx` — adicionar descriptions, envolver itens com Tooltip

### Escopo
- Apenas visual/UX, sem mudança de lógica ou navegação
- Usa componente Tooltip já existente no projeto

