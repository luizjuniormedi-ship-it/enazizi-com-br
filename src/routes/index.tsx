import React from 'react';

export default function EG2Benchmark() {
  const content = `EXECUTE EG-2 GROUNDED CLINICAL BENCHMARK NOW.

Use the certified Evidence Context Pack infrastructure already implemented.

Do not modify production routing, provider flags, prompts, RLS, public UI or pedagogical databases.

Compare:
- google/gemini-2.5-flash
- openai/gpt-5-mini
- nvidia meta/llama-3.1-8b-instruct
- cerebras gpt-oss-120b
- google/gemini-2.5-pro

For every case:
1. retrieve evidence ONCE
2. freeze Evidence Context Pack
3. generate context_hash
4. send the exact same context to every provider
5. reject the benchmark if hashes differ

Execute 20 clinical cases.

Mandatory topics:
IAM/STEMI
Sepse/Choque Séptico
TEP
Cetoacidose Diabética Pediátrica
Bronquiolite
AVC Isquêmico
Pré-eclâmpsia
Abdome Agudo

For each case execute:
- ENARE Question Generation
- Tutor explanation
- Clinical Simulation decision task

Measure:
Grounding Score
Unsupported Claim Rate
Critical Hallucination Rate
Answer-Key Support
Evidence Coverage
Evidence Conflict Handling
Exact Topic Fidelity
Sibling Contamination
JSON/Contract Compliance
HTTP success
p50/p95 latency
timeouts
429
5xx
empty content
retry rate
tokens

Hard gates:
Grounding < 0.90 => FAIL
Critical Hallucination > 0 => FAIL
Unsupported Claim Rate > 0.05 => FAIL
Unsupported Answer Key => FAIL
Sibling Contamination => FAIL
Different context_hash across providers => BENCHMARK INVALID

Cerebras:
Never expose reasoning as final content.
content empty + reasoning present => INCOMPLETE_GENERATION.
Retry with adequate token budget, then fallback if still incomplete.

Do not persist generated questions to questions_bank or GOLD.

Do not promote any provider.

Return:
WAR ROOM — EG-2 GROUNDED CLINICAL BENCHMARK

Per-model table:
SUCCESS
GROUNDING
UNSUPPORTED CLAIMS
CRITICAL HALLUCINATIONS
ANSWER KEY SUPPORT
TOPIC FIDELITY
SIBLING CONTAMINATION
JSON
P50
P95
RETRY RATE

Then recommend only:
DEFAULT
QUESTION_GENERATOR
TUTOR
CLINICAL_SIMULATION
FAST
DEEP_REASONING
FALLBACK
SHADOW_ONLY
REJECTED

Final status:
EG-2 BENCHMARK CERTIFIED
READY FOR EG-3 ROUTER

or

EG-2 BENCHMARK NOT CERTIFIED`;

  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen whitespace-pre-wrap">
      {content}
    </div>
  );
}
