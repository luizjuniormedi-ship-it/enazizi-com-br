# Corrigir a taxonomia do banco de questões e publicar o commit 0bae7dce9

## Situação verificada agora

- O código do projeto já está idêntico à main do GitHub no commit `0bae7dce9` (PR #67, que contém integralmente o PR #66 `fe9cdba95`). Não há diferença de arquivos.
- O PR #67 traz apenas um arquivo: a migração `20260915100000_repair_questions_bank_curriculum_theme_from_taxonomy.sql`. Ela ainda **não foi aplicada** no banco.
- A migração realinha o rótulo de especialidade de cada questão a partir da taxonomia oficial (especialidade → tema → subtema, e por texto quando não houver vínculo), e no final **falha de propósito** se ainda sobrar alguma questão de Pediatria/Anestesiologia/Endocrinologia/Nutrição/Gastro/Depressão marcada como Cardiologia.

## O que será feito

1. **Aplicar a migração** no banco canônico, exatamente como está no commit — sem editar uma linha.
   - Se a validação final da própria migração falhar, ela desfaz tudo e eu paro: significa que sobram questões cuja especialidade real não é dedutível pela taxonomia. Nesse caso reporto os números e peço decisão editorial, sem afrouxar nada.
2. **Conferir o resultado** com contagens antes/depois: quantas questões mudaram de rótulo, quantas continuam como Cardiologia e quantas dessas são realmente de Cardiologia.
3. **Redeploy** de `question-generator` e `tutor-v3-premium` (as duas já estão na versão do PR #66; o redeploy garante cache limpo após a correção de dados).
4. **Teste real de Simulados**: entrar como aluno, escolher só Cardiologia, "Montar com Banco" e conferir na tela o rótulo de cada questão aberta. Aceito: tudo compatível com Cardiologia, ou erro claro de corpus insuficiente. Reprovo se aparecer Pediatria/Anestesiologia/Endocrinologia/Nutrição.
5. **Teste real do Tutor IA**: gerar uma aula e confirmar que não aparece bloco de dados bruto para o aluno.
6. **Publicar o site** somente se os passos 4 e 5 passarem.
7. **Confirmar a publicação**: mostrar o identificador do deploy e o arquivo do novo pacote servido por enazizi.com, provando que `assets/index-B4aJhJ-4.js` não é mais entregue.

## Limites respeitados

- Nada de criar rota, tela, função, tabela ou fluxo paralelo.
- Banco canônico preservado (`qszsyskumcmuknumwxtk`).
- Guard clínico do PR #66 intocado — nenhuma flexibilização de filtro.
- Não publico 15f94e4 nem o PR #65 isolado; a publicação será de `0bae7dce9`.
- Se qualquer validação falhar, não publico e mostro o erro exato.

## Detalhes técnicos

- Sync: `refs/remotes/github/main` = `0bae7dce9`; `git diff` contra ele está vazio.
- Migração aplicada via ferramenta de migração do Supabase com o SQL literal do repositório (inclui `BEGIN/COMMIT`, tabela temporária de auditoria e `RAISE EXCEPTION` de guarda).
- Evidência do Simulados coletada por captura de rede (payload enviado ao `question-generator` e `_visible_topic`/`_topic_bucket` de cada questão) + screenshot da prova.
- Evidência de produção: `curl -I` em https://enazizi.com comparando `x-deployment-id` e o hash do bundle com o atual `7debb0b3-.../index-B4aJhJ-4.js`.
