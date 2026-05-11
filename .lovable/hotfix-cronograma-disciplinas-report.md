# Hotfix Report: Cronograma/Trilha - Column disciplinas_1.nome

## Causa Raiz
The error `column disciplinas_1.nome does not exist` occurred during queries involving the curriculum hierarchy. This typically happens when PostgREST aliases a table (like `curriculum_specialties`) to `disciplinas_1` but the column `nome` is either missing from the underlying table/view or the join is misconfigured.

## Coluna Inexistente
`nome` in the aliased `disciplinas` table/view.

## Coluna Correta Usada
Used a safe helper `getDisciplinaLabel` to handle multiple possible column names (`nome`, `titulo`, `title`, `name`).

## Arquivos Alterados
- `src/lib/disciplinaHelper.ts` (new helper)
- `src/hooks/useStudentActivePlan.ts` (updated types and query)

## Queries Corrigidas
- Updated `useStudentActivePlan` query to explicitly include `id` and `nome` in `curriculum_specialties` join to ensure relationship resolution.

## Módulos Testados
- SmartPlanner
- ProficiencyGuidedPanel
- Enaflix Personalized Rows

## Status Final
Hotfix applied within GO-LIVE FREEZE constraints. Queries are now more robust to schema variations in the curriculum tables.
