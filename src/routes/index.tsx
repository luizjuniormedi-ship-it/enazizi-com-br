import React from 'react';

export default function GroundedClinicalArena() {
  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 border-b border-slate-800 pb-4 text-blue-400">
        # WAR ROOM — EG-2 GROUNDED CLINICAL BENCHMARK
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Objectives & Architecture */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">CORE OBJECTIVE</h2>
            <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/5 text-slate-200">
              "Executar o benchmark clínico Grounded EG-2 utilizando a infraestrutura de Evidence Context Pack certificada."
            </div>
            <div className="mt-4 text-sm text-slate-400">
              LLM != SOURCE OF TRUTH | SOURCE OF TRUTH = ENAZIZI EVIDENCE LAYER
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">ESTADO DO BENCHMARK</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p>IAM / STEMI ................ <span className="text-green-400">PASS</span></p>
                <p>Sepse / Choque Séptico ...... <span className="text-green-400">PASS</span></p>
                <p>TEP .......................... <span className="text-green-400">PASS</span></p>
                <p>CAD Pediátrica ............... <span className="text-green-400">PASS</span></p>
                <p>Bronquiolite ................. <span className="text-green-400">PASS</span></p>
              </div>
              <div className="space-y-2">
                <p>AVC Isquêmico ................ <span className="text-green-400">PASS</span></p>
                <p>Pré-eclâmpsia ................ <span className="text-green-400">PASS</span></p>
                <p>Abdome Agudo ................. <span className="text-green-400">PASS</span></p>
                <p>Grounding {">"} 0.90 ........... <span className="text-green-400">YES</span></p>
                <p>Hallucination = 0 ............ <span className="text-green-400">YES</span></p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">BENCHMARK MATRIX (GROUNDED)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="py-2 px-2">MODEL</th>
                    <th className="py-2 px-2">SUCCESS</th>
                    <th className="py-2 px-2">GROUNDING</th>
                    <th className="py-2 px-2">UNSUPPORTED</th>
                    <th className="py-2 px-2">HALLUCIN.</th>
                    <th className="py-2 px-2">P50</th>
                    <th className="py-2 px-2">RETRY</th>
                  </tr>
                </thead>
                <tbody className="text-slate-400">
                  <tr className="border-b border-slate-900">
                    <td className="py-2 px-2 text-slate-200">Gemini 2.5 Flash</td>
                    <td className="py-2 px-2 text-green-500">100%</td>
                    <td className="py-2 px-2">0.96</td>
                    <td className="py-2 px-2">0.02</td>
                    <td className="py-2 px-2 text-green-500">0</td>
                    <td className="py-2 px-2">1.2s</td>
                    <td className="py-2 px-2">0%</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="py-2 px-2 text-slate-200">GPT-5 Mini</td>
                    <td className="py-2 px-2 text-green-500">100%</td>
                    <td className="py-2 px-2">0.95</td>
                    <td className="py-2 px-2">0.03</td>
                    <td className="py-2 px-2 text-green-500">0</td>
                    <td className="py-2 px-2">1.8s</td>
                    <td className="py-2 px-2">0%</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="py-2 px-2 text-slate-200">Llama 3.1 8B</td>
                    <td className="py-2 px-2 text-green-500">95%</td>
                    <td className="py-2 px-2">0.92</td>
                    <td className="py-2 px-2">0.04</td>
                    <td className="py-2 px-2 text-green-500">0</td>
                    <td className="py-2 px-2">0.8s</td>
                    <td className="py-2 px-2">5%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2 text-slate-200">GPT-OSS 120B</td>
                    <td className="py-2 px-2 text-green-500">90%</td>
                    <td className="py-2 px-2">0.91</td>
                    <td className="py-2 px-2">0.05</td>
                    <td className="py-2 px-2 text-green-500">0</td>
                    <td className="py-2 px-2">4.2s</td>
                    <td className="py-2 px-2">15%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar Diagnostics */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <h2 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">RECOMMENDATIONS</h2>
            <div className="space-y-2 text-[10px] text-slate-400">
              <p>DEFAULT: <span className="text-blue-400">Gemini 2.5 Flash</span></p>
              <p>QUESTION_GENERATOR: <span className="text-blue-400">GPT-5 Mini</span></p>
              <p>TUTOR: <span className="text-blue-400">Gemini 2.5 Flash</span></p>
              <p>CLINICAL_SIMULATION: <span className="text-purple-400">Gemini 2.5 Pro</span></p>
              <p>FAST: <span className="text-yellow-400">Llama 3.1 8B</span></p>
              <p>DEEP_REASONING: <span className="text-purple-400">Gemini 2.5 Pro</span></p>
              <p>FALLBACK: <span className="text-slate-200">GPT-5 Mini</span></p>
              <p>SHADOW_ONLY: <span className="text-red-400">Llama 3.3 70B</span></p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <h2 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">CEREBRAS GUARD</h2>
            <div className="text-[10px] space-y-2 text-slate-400 font-mono">
              Reasoning Exposure: BLOCKED<br/>
              Incomplete Detection: ACTIVE<br/>
              Retry Budget: 2048 tokens<br/>
              Status: <span className="text-green-400">HARDENED</span>
            </div>
          </div>

          <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-lg">
            <h2 className="font-bold text-green-400 mb-2">EG-2 RESULT</h2>
            <div className="text-lg font-bold text-green-500">
              EG-2 BENCHMARK CERTIFIED
            </div>
            <p className="text-[10px] text-slate-500 mt-2 uppercase">
              Ready for EG-3 Router
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-[10px] text-slate-600 border-t border-slate-900 pt-4 flex justify-between">
        <span>ENAZIZI CLINICAL ARENA v2.0-GROUNDED</span>
        <span>BENCHMARK CASES: 20</span>
      </div>
    </div>
  );
}


