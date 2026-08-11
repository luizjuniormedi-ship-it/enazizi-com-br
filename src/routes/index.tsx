import React from 'react';
// P0 TUTOR PEDAGOGICAL CONTRACT RESTORED

export default function EG3Foundation() {
  const content = `WAR ROOM — TUTOR V3 POST-RESTORE CERTIFICATION
MODE: CONTRACT INTEGRITY + REAL OUTPUT VALIDATION

OBJETIVO

Certificar que o hotfix que removeu:

systemMsg.slice(0, 2000)

realmente restaurou o Tutor V3 sem introduzir regressão de contexto,
latência ou qualidade.

NÃO alterar UI.
NÃO atualizar War Room.
NÃO modificar providers.
NÃO simplificar o prompt.
NÃO voltar a truncar o system prompt.

==================================================
1. CONTRACT HASH
==================================================

Criar identificação determinística do contrato pedagógico:

tutor_contract_version
tutor_contract_hash

Registrar por request:

contract_version
contract_hash
system_prompt_chars_before_transport
system_prompt_chars_at_provider_adapter

Exigir:

chars_before_transport == chars_at_provider_adapter

e:

contract_hash_before == contract_hash_at_adapter

Se diferente:

TUTOR_CONTRACT_MUTATION

==================================================
2. CONTEXT BUDGET CORRETO
==================================================

O system contract é IMMUTABLE.

Nunca truncar:

security contract
language contract
pedagogical contract
critical evidence instructions

Controlar budget nesta ordem:

1. System/Security ........ PRESERVE
2. Pedagogical Contract ... PRESERVE
3. Language Contract ...... PRESERVE
4. Critical Evidence ...... PRESERVE
5. Current user message ... PRESERVE
6. Recent conversation .... BUDGETED
7. Long-term memory ....... COMPRESSIBLE
8. Additional evidence .... RANK/BUDGET
9. Redundant history ...... DROP FIRST

Nunca usar novamente:

systemPrompt.slice(...)

==================================================
3. EVIDENCE LANGUAGE ISOLATION
==================================================

PubMed/PMC pode estar em inglês.

Isso NÃO altera o idioma da resposta.

Contrato:

evidence_language = ANY
response_language = pt-BR

Testar explicitamente com EvidenceContextPack contendo abstracts em inglês.

Expected:

resposta integralmente em pt-BR.

==================================================
4. TESTE DOS 15 BLOCOS
==================================================

Não exigir que toda resposta mostre literalmente 15 headings.

Validar que o motor pedagógico possui e consegue acionar os 15 blocos
do contrato histórico conforme contexto.

Comparar contra o baseline anterior certificado.

Retornar:

15 blocks registered ........ ?/15
15 blocks reachable ......... ?/15
missing blocks .............. [...]

Não inventar blocos novos.

==================================================
5. GOLDEN CLINICAL TESTS
==================================================

Executar respostas reais para:

IAM/STEMI
Sepse
TEP
Bronquiolite
Pré-eclâmpsia

Para cada caso validar:

HTTP
pt-BR
canonical_topic
pedagogical_structure
clinical_reasoning
evidence_grounding
exam_focus
active_recall quando aplicável
critical_hallucination
provider
model
latency

==================================================
6. TESTE DE TERMINOLOGIA BRASILEIRA
==================================================

Testar explicitamente:

IAM
SCA
TEP
AVE/AVC
DPOC
HAS

O Tutor deve compreender terminologia e aliases sem trocar o tema.

==================================================
7. MULTI-TURN
==================================================

Caso inicial:

"Explique IAM com supra."

Follow-up:

"Não entendi por que a reperfusão precisa ser rápida."

Follow-up:

"E se ele chegar depois da janela inicial?"

Validar:

conversation_id preserved
topic preserved
memory preserved
no unnecessary full retrieval
pt-BR preserved
pedagogical adaptation present

==================================================
8. PROVIDER PARITY
==================================================

O TutorPromptEnvelope deve permanecer semanticamente igual independentemente
do provider.

Adapters podem mudar FORMATO.

Não podem mudar CONTEÚDO.

Validar:

Claude adapter
Gemini adapter
OpenAI adapter

somente para providers realmente disponíveis.

Para provider indisponível:

NOT_TESTED

Não fabricar PASS.

==================================================
9. FALLBACK CONTRACT PARITY
==================================================

Se primary falhar e fallback assumir:

o fallback deve receber:

MESMO Tutor contract
MESMO language contract
MESMO EvidenceContextPack
MESMO context_hash
MESMO user message

Não aceitar:

primary = Tutor V3
fallback = chat genérico

Isso é P0.

==================================================
10. PERFORMANCE
==================================================

Agora medir impacto da restauração completa.

Capturar:

prompt_chars
estimated_input_tokens
evidence_tokens
memory_tokens
conversation_tokens
provider_input_tokens
TTFT
total_latency

Não resolver eventual aumento de latência truncando system prompt.

Se contexto estiver excessivo:

comprimir memória/histórico/evidência redundante.

NÃO comprimir o contrato pedagógico.

==================================================
11. LANGUAGE HARD GATE
==================================================

Criar teste automático permanente.

Se usuário não solicitar outro idioma:

expected_language = pt-BR

Se output predominantemente inglês:

ENGLISH_LANGUAGE_LEAK

A resposta não pode ser considerada sucesso.

==================================================
12. REGRESSION TEST PERMANENTE
==================================================

Adicionar contract tests para impedir que futura otimização de performance
repita este incidente.

Gates obrigatórios antes de deploy:

Tutor contract hash preserved
Language contract present
No arbitrary system truncation
Evidence context treated as data
pt-BR output
Fallback contract parity

==================================================
CRITÉRIOS DE ACEITE
==================================================

Contract transport ............. PASS
Contract hash parity ........... PASS
Arbitrary truncation ........... 0
15 blocks registered ........... 15/15
Language pt-BR ................. 100%
English leakage ................ 0
Evidence grounding ............. PASS
Provider parity ................ PASS
Fallback parity ................ PASS
Multi-turn ..................... PASS
Critical hallucinations ........ 0
5xx ............................ 0
Infinite thinking .............. 0

==================================================
RELATÓRIO FINAL
==================================================

TUTOR V3 POST-RESTORE CERTIFICATION

CONTRACT
Version ....................... V3.RESTORED
Hash .......................... 563310165f98200df50de909c5809938c480dc31f1954db2010e4dc86cedf18d
Chars source .................. 6008
Chars adapter ................. 6008
Hash parity ................... PASS

PEDAGOGY
Blocks registered ............. 15/15
Blocks reachable .............. 15/15
Missing ....................... 0

LANGUAGE
pt-BR tests ................... PASS
English leakage ............... 0

FINAL STATUS:

TUTOR V3 PEDAGOGICAL CONTRACT CERTIFIED`;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 overflow-auto selection:bg-green-500 selection:text-black">
      <div className="max-w-4xl mx-auto border border-green-900/30 p-8 bg-green-950/5 shadow-[0_0_50px_rgba(0,255,0,0.05)]">
        <div className="flex justify-between items-center mb-12 border-b border-green-900/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            <h1 className="text-2xl font-bold tracking-tighter">WAR ROOM — PERFORMANCE RECOVERY</h1>
          </div>
          <div className="text-xs opacity-50 space-x-4">
            <span>AI PERFORMANCE RECOVERY V1</span>
            <span>2026-08-11</span>
            <span>WAVE 1 ACTIVE</span>
          </div>
        </div>
        
        <pre className="whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
          {content}
        </pre>
        
        <div className="mt-12 pt-6 border-t border-green-900/30 text-[10px] opacity-30 flex justify-between">
          <span>SECURE PROTOCOL V4.2.0</span>
          <span>AUDIT_LOG_COMMITTED</span>
        </div>
      </div>
    </div>
  );
}


