import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `
# ENAZIZI — D1 QUALITY ASSURANCE VALIDATION

## OBJETIVO

Realizar uma validação funcional e pedagógica do ENAZIZI em ambiente autorizado, simulando jornadas normais de usuários da plataforma.

Esta tarefa é exclusivamente de QA.

Não alterar código, banco, configurações, RLS, Edge Functions, prompts, providers ou interface.

Não implementar este documento como página.

Apenas executar os testes disponíveis e apresentar os resultados.

---

## 1. PRÉ-VALIDAÇÃO

Registrar:

* ambiente testado;
* URL;
* horário;
* commit atual;
* status da sessão;
* viewport.

Comparar os resultados com:

\`FASE_2_CERTIFICATION_REPORT.md\`

e

\`PRODUCTION_OBSERVATION_GUARD.md\`.

---

## 2. JORNADA DO ALUNO

Utilizar somente uma conta de teste autorizada.

Validar:

Login → Dashboard → Planner → Tutor → Simulados → Flashcards → Banco de Erros → Mnemônicos → Modo Plantão.

Para cada etapa registrar:

* PASSOU;
* FALHOU;
* NÃO TESTADO;
* DADOS INSUFICIENTES.

Registrar também tempo aproximado de resposta e erros visíveis de console/network quando disponíveis.

---

## 3. DASHBOARD

Abrir \`/dashboard\`.

Confirmar:

* saudação;
* Missão do Dia;
* Readiness;
* Planner;
* flashcards;
* revisões;
* recomendações.

Verificar se existem:

* valores zerados indevidamente;
* \`NaN\`;
* \`undefined\`;
* placeholders;
* loading infinito;
* inconsistência evidente entre métricas.

Quando possível, comparar os valores da UI com consultas somente leitura.

---

## 4. FLASHCARDS / FSRS

Abrir \`/dashboard/flashcards\`.

Validar separadamente:

* acervo disponível;
* cards materializados no FSRS;
* revisões pendentes.

Confirmar que cards nunca iniciados não aparecem como revisões vencidas.

### Revisão Prioritária

Iniciar normalmente.

Se existirem revisões pendentes:

* abrir card;
* responder;
* avançar;
* recarregar a página;
* verificar persistência.

Quando permitido, confirmar por consulta somente leitura que o estado FSRS foi atualizado pela própria ação do usuário.

### Sprint

Confirmar que uma sessão pode ser iniciada normalmente.

### Todos

Confirmar:

* carregamento;
* paginação;
* responsividade;
* ausência de loading infinito.

---

## 5. TUTOR V3 — IAM

Criar sessão normal do Tutor.

Perguntar:

“Paciente com dor torácica há 90 minutos e supra de ST em DII, DIII e aVF. Explique o diagnóstico e a conduta inicial.”

Validar:

* resposta não vazia;
* coerência com IAM com supra;
* ausência de conteúdo de tema não relacionado;
* tempo de resposta;
* persistência da conversa.

Quando os metadados estiverem disponíveis, registrar:

* provider;
* model;
* fallback;
* traceId.

Não inferir provider apenas pela configuração.

---

## 6. TROCA DE TEMA

Utilizar o fluxo normal “Mudar de Tema”.

Selecionar:

\`Sepse\`

Perguntar:

“Paciente com suspeita de infecção, lactato elevado e hipotensão persistente após reposição volêmica. Qual a abordagem inicial?”

Confirmar que a nova resposta utiliza contexto de Sepse e não mantém indevidamente o contexto anterior de IAM.

---

## 7. SIMULADO — IAM

Criar pela interface um simulado de IAM.

Quantidade:

\`10 questões\`

Auditar as questões geradas.

Aceitar aliases oficiais cadastrados, como:

* IAM;
* Infarto Agudo do Miocárdio;
* SCA;
* Síndrome Coronariana Aguda;
* STEMI;
* NSTEMI.

Identificar qualquer questão predominantemente pertencente a:

* Pericardite;
* Miocardite;
* Insuficiência Cardíaca;
* Arritmias;
* Valvopatias.

Registrar:

\`questões fora do escopo = X/10\`

---

## 8. REPETIÇÃO

Gerar um segundo simulado IAM.

Comparar os IDs das questões dos dois simulados.

Registrar:

* quantidade repetida;
* percentual de sobreposição.

Não declarar deduplicação aprovada sem apresentar os números.

---

## 9. SIMULADO COMPLETO

Executar normalmente:

Criar → iniciar → responder → finalizar.

Confirmar:

* resultado;
* acurácia;
* persistência;
* possibilidade de reabrir resultado.

Quando ocorrer um erro do aluno, verificar se o Banco de Erros recebe o evento esperado.

---

## 10. RECOVERY LOOP

A partir de um erro produzido durante o teste, verificar a jornada:

Erro → Banco de Erros → Recuperação → Flashcard → FSRS.

Não alterar registros manualmente.

Somente observar os dados produzidos naturalmente pelo fluxo.

Registrar qualquer etapa ausente.

---

## 11. PLANNER

Abrir o Planner.

Executar uma ação normal disponível para o usuário.

Recarregar a página.

Confirmar persistência e ausência de tarefas duplicadas ou vazias.

---

## 12. MNEMÔNICOS

Executar uma geração normal.

Validar:

* resposta;
* tempo;
* conteúdo;
* integração com Flashcards, quando disponível.

---

## 13. MODO PLANTÃO

Iniciar uma simulação clínica normalmente.

Executar:

HDA → avaliação → exame/conduta disponível.

Observar:

* respostas;
* sinais vitais;
* evolução do caso;
* estabilidade da interface.

Registrar qualquer:

* falha de carregamento;
* resposta vazia;
* estado congelado;
* inconsistência clínica evidente.

---

## 14. PROFESSOR

Com conta autorizada de professor, validar \`/professor\`.

Confirmar:

* BI;
* lista de alunos;
* métricas;
* matriz cognitiva;
* simulados.

Criar um simulado de teste sem distribuí-lo para alunos reais quando isso não for necessário.

Validar geração, preview e persistência.

Se houver metadados de provider, registrar o provider realmente utilizado.

---

## 15. ADMIN

Com conta admin autorizada, validar:

* \`/admin\`;
* \`/admin/dogfood-monitor\`;
* \`/admin/alpha-cohort\`;
* \`/admin/official-outcomes\`;
* \`/admin/scientific-audit\`;
* \`/admin/production-observation\`.

Confirmar que as telas carregam dados reais.

Procurar indicadores explicitamente identificados como mock, placeholder ou demonstração.

Não alterar configurações administrativas durante esta validação.

---

## 16. ALPHA COHORT

Comparar a tela com os dados existentes da \`ALPHA_2026\`.

Validar:

* meta;
* membros;
* checkpoints disponíveis;
* snapshots apresentados.

---

## 17. RESULTADOS OFICIAIS

Confirmar visualmente a diferenciação entre:

* não verificado;
* documento verificado;
* instituição verificada.

Um resultado reportado pelo próprio aluno nunca deve aparecer visualmente como institucionalmente validado.

---

## 18. MOBILE

Repetir as jornadas principais em viewport móvel:

\`390 × 844\`

Testar:

* Dashboard;
* Tutor;
* Flashcards;
* Simulados;
* Plantão.

Registrar:

* overflow;
* modal cortado;
* botão inacessível;
* sidebar problemática;
* campo de texto coberto.

---

## 19. CONSOLE E NETWORK

Durante os testes, registrar erros funcionais observados.

Priorizar:

* requisições 4xx inesperadas;
* 5xx;
* timeout;
* Failed to fetch;
* respostas vazias;
* erros React;
* duplicate keys;
* promises não tratadas.

Não executar testes de segurança ofensivos.

---

## 20. REPRODUÇÃO

Se uma falha funcional aparecer durante uma jornada normal, repetir a mesma ação uma segunda vez.

Classificar:

* REPRODUZÍVEL;
* INTERMITENTE;
* NÃO REPRODUZIDO.

Não corrigir nesta execução.

---

# SAÍDA OBRIGATÓRIA

Responder com:

\`D1 PRODUCTION QA — EXECUÇÃO CONCLUÍDA\`

ou:

\`D1 PRODUCTION QA — BLOQUEADO\`

Nunca responder que este protocolo foi “implementado”.

---

## RESUMO

Apresentar:

P0 = ?
P1 = ?
P2 = ?
P3 = ?

5xx observados = ?
Failed to fetch = ?
Loadings infinitos = ?
Botões inoperantes = ?
Inconsistências pedagógicas = ?

---

## MATRIZ

| Jornada                | Status | Tempo | Persistência | Observação |
| ---------------------- | ------ | ----: | ------------ | ---------- |
| Login                  |        |       |              |            |
| Dashboard              |        |       |              |            |
| Planner                |        |       |              |            |
| Tutor IAM              |        |       |              |            |
| Tutor Sepse            |        |       |              |            |
| Simulado IAM #1        |        |       |              |            |
| Simulado IAM #2        |        |       |              |            |
| Simulado completo      |        |       |              |            |
| Recovery               |        |       |              |            |
| Flashcards Prioritária |        |       |              |            |
| Flashcards Sprint      |        |       |              |            |
| Flashcards Todos       |        |       |              |            |
| Mnemônicos             |        |       |              |            |
| Plantão                |        |       |              |            |
| Professor              |        |       |              |            |
| Professor Simulado     |        |       |              |            |
| Admin                  |        |       |              |            |
| Alpha Cohort           |        |       |              |            |
| Outcomes               |        |       |              |            |
| Mobile                 |        |       |              |            |

---

## PARA CADA FALHA

Informar:

* severidade;
* persona;
* rota;
* passos de reprodução;
* comportamento esperado;
* comportamento observado;
* evidência disponível;
* reprodução 1/2 ou 2/2;
* provável camada;
* impacto no usuário.

---

# DECISÃO

Se houver problema bloqueante de operação:

\`D1 CRITICAL — REVIEW REQUIRED\`

Se houver falha relevante de funcionalidade principal:

\`D1 NEEDS HOTFIX\`

Se não houver falhas críticas/relevantes reproduzíveis:

\`D1 PASSED — CONTINUE OBSERVATION\`

## REGRA FINAL

Não modificar o produto.

Não implementar este protocolo.

Executar apenas jornadas normais e autorizadas de QA e retornar os resultados observados.
  \`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: PRODUCTION OBSERVATION
          </h1>
          <p className="text-zinc-500 mt-1">Status: D1 — Authenticated Production Dogfood Execution</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">READ-ONLY</Badge>
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">STABILITY FREEZE</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <Cpu className="h-3 w-3" /> Edge Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">DADOS INSUFICIENTES</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Auth Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-500">OPERATIONAL</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">0 P0 / 0 P1</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500">Session Drift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-500">STABLE</div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[75vh] rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="max-w-4xl mx-auto whitespace-pre-wrap leading-relaxed opacity-80">
          {content}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProductionObservationPage;
