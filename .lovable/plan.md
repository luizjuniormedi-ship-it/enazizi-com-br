

## Problemas Identificados

1. **Menu móvel incompleto para admins**: O menu móvel (`MobileNav` em `DashboardLayout.tsx`) não mostra os links "Mnemônico (teste)" e "Painel CEO" na seção admin do rodapé (linhas 195-207). O sidebar desktop tem esses links, mas o mobile não.

2. **Menu móvel sem link institucional**: O link "Painel Institucional" também está ausente no menu móvel, ao contrário do sidebar desktop.

## Alterações Necessárias

### Arquivo: `src/components/layout/DashboardLayout.tsx`

1. **Importar `useInstitution` e ícones faltantes** (`Building2`, `Brain`, `BarChart3`, `Crown`)

2. **Adicionar `useInstitution` no componente `MobileNav`** para verificar `isInstitutionalStaff`

3. **Adicionar links admin faltantes** na seção do rodapé do menu móvel (após o link "Admin"):
   - "Mnemônico (teste)" → `/dashboard/mnemonico` (apenas admin)
   - "Painel CEO" → `/admin/ceo` (apenas admin)
   - "Painel Institucional" → `/institucional` (apenas staff institucional)

Isso espelha exatamente o que o sidebar desktop (`DashboardSidebar.tsx`) já mostra nas linhas 220-250.

