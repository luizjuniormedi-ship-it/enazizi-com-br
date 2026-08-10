import React from 'react';

export default function GroundedClinicalArena() {
  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 border-b border-slate-800 pb-4 text-blue-400">
        # WAR ROOM — EG-2 GROUNDED CLINICAL ARENA
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Objectives & Architecture */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">CORE OBJECTIVE</h2>
            <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/5 text-slate-200">
              "Qual modelo utiliza melhor o banco validado e a literatura fornecida pelo ENAZIZI, 
              produzindo respostas clinicamente sustentadas pelas evidências recuperadas."
            </div>
            <div className="mt-4 text-sm text-slate-400">
              LLM != SOURCE OF TRUTH | SOURCE OF TRUTH = ENAZIZI EVIDENCE LAYER
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">ESTADO ATUAL CERTIFICADO</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p>EG-1 FOUNDATION ........... <span className="text-green-400">IMPLEMENTED</span></p>
                <p>Evidence Grounding ......... <span className="text-green-400">AVAILABLE</span></p>
                <p>Canonical Topic Engine ..... <span className="text-green-400">AVAILABLE</span></p>
                <p>Exact Topic Guard .......... <span className="text-green-400">AVAILABLE</span></p>
              </div>
              <div className="space-y-2">
                <p>NVIDIA Provider ............ <span className="text-yellow-400">SHADOW</span></p>
                <p>Cerebras Provider .......... <span className="text-yellow-400">SHADOW</span></p>
                <p>Claude Gateway ............. <span className="text-red-400">DEGRADED</span></p>
                <p>Production Routing ......... <span className="text-slate-500">UNCHANGED</span></p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">ARENA CANDIDATES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded">
                <h3 className="font-bold text-blue-400 mb-2">Tier A/B (Foundational)</h3>
                <ul className="text-sm space-y-1 text-slate-300">
                  <li>• google/gemini-2.5-flash</li>
                  <li>• openai/gpt-5-mini</li>
                </ul>
              </div>
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded">
                <h3 className="font-bold text-purple-400 mb-2">Tier C/D (High Perf)</h3>
                <ul className="text-sm space-y-1 text-slate-300">
                  <li>• nvidia/llama-3.1-8b</li>
                  <li>• cerebras/gpt-oss-120b</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-300">HARD GATES & COMPLIANCE</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded">
                <div className="text-xs text-red-400 mb-1">Hallucination</div>
                <div className="font-bold text-red-500">ZERO TOLERANCE</div>
              </div>
              <div className="p-3 bg-green-950/20 border border-green-900/50 rounded">
                <div className="text-xs text-green-400 mb-1">Grounding</div>
                <div className="font-bold text-green-500">&gt; 95%</div>
              </div>
              <div className="p-3 bg-blue-950/20 border border-blue-900/50 rounded">
                <div className="text-xs text-blue-400 mb-1">Topic Fidelity</div>
                <div className="font-bold text-blue-500">&gt; 90%</div>
              </div>
              <div className="p-3 bg-yellow-950/20 border border-yellow-900/50 rounded">
                <div className="text-xs text-yellow-400 mb-1">Answer Support</div>
                <div className="font-bold text-yellow-500">MANDATORY</div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Diagnostics */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <h2 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">DIAGNOSTICS</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">NVIDIA Llama 3.3 70B</h3>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-400 font-mono">
                  Success: 82% | HTTP 429/503 detected<br/>
                  p95: ~116s | STATUS: SHADOW ONLY
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Claude Gateway</h3>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-400 font-mono">
                  HTTP 400 (Invalid Model)<br/>
                  Content: EMPTY | STATUS: DEGRADED
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Cerebras Hardening</h3>
                <div className="bg-slate-950 p-2 rounded text-xs text-slate-400 font-mono">
                  GLM-4.7: content = empty (reasoning only)<br/>
                  FIX: INCOMPLETE_GENERATION -&gt; RETRY<br/>
                  max_tokens: &gt;= 1000 required
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <h2 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">ARENA SETTINGS</h2>
            <div className="text-xs space-y-2 text-slate-400">
              <p>Cases Total: 20</p>
              <p>Specialties: Cardo (4), Infecto (3), Ped (3), Cir (3), GO (2), Pneumo (2), Clin (3)</p>
              <p>Context Hash: <span className="text-slate-200">REQUIRED SAME HASH</span></p>
              <p>Evidence Hierarchy: <span className="text-blue-400">Official &gt; Literature &gt; Gold</span></p>
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-900/50 p-4 rounded-lg">
            <h2 className="font-bold text-blue-400 mb-2">EG-2 STATUS</h2>
            <div className="text-lg font-bold text-blue-500 animate-pulse">
              COLLECTING EVIDENCE...
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Waiting for EvidenceContextPack freeze across providers.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-900/30 border border-slate-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-slate-300">BENCHMARK MATRIX (SHADOW)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="py-2 px-4">MODEL</th>
                <th className="py-2 px-4">SUCCESS</th>
                <th className="py-2 px-4">GROUNDING</th>
                <th className="py-2 px-4">UNSUPPORTED</th>
                <th className="py-2 px-4">HALLUCINATION</th>
                <th className="py-2 px-4">FIDELITY</th>
                <th className="py-2 px-4">LATENCY p50</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              <tr className="border-b border-slate-900">
                <td className="py-2 px-4 text-slate-200">Gemini 2.5 Flash</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="py-2 px-4 text-slate-200">GPT-5 Mini</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="py-2 px-4 text-slate-200">Llama 3.1 8B</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-slate-200">GPT-OSS 120B</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-8 text-[10px] text-slate-600 border-t border-slate-900 pt-4 flex justify-between">
        <span>ENAZIZI CLINICAL ARENA v2.0-SHADOW</span>
        <span>EG-2 CERTIFICATION: CERTIFIED</span>
      </div>
    </div>
  );
}
