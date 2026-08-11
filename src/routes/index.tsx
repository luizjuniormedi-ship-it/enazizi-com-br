import React from 'react';

export default function WarRoom() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-4 border-b border-white/10 pb-8">
          <div className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">P0 CERTIFICATION MODE</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
            WAR ROOM — TOPIC LOCK REAL <span className="text-indigo-500">E2E CERTIFICATION</span>
          </h1>
          <p className="text-rose-500 text-sm font-bold uppercase tracking-widest animate-pulse">
            NO MORE IMPLEMENTATION BEFORE TESTING
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] leading-relaxed">
          <div className="space-y-6">
            <div>
              <h2 className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-2">OBJETIVO</h2>
              <p className="text-slate-400">Certificar em execução REAL o Topic Lock recém-implementado.</p>
              <div className="mt-4 p-4 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                <p className="text-rose-400 font-bold mb-1 italic">NÃO ALTERAR:</p>
                <ul className="list-disc list-inside text-slate-500 space-y-1">
                  <li>TutorPromptEnvelope</li>
                  <li>Providers</li>
                  <li>Evidence Engine</li>
                  <li>Performance / UI</li>
                  <li>War Room</li>
                  <li>Topic Lock durante o teste</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-4">
              <h3 className="text-white font-bold border-b border-white/10 pb-2">TEST 1 — NOVA SESSÃO BRONQUIOLITE</h3>
              <p className="text-slate-400">Criar sessão NOVA.</p>
              <div className="space-y-2">
                <p className="text-emerald-400 font-bold italic">Input exato:</p>
                <code className="block bg-black/40 p-2 rounded text-indigo-300">"Quero estudar: bronqueolite"</code>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-black/20 p-2 rounded">
                  <p className="text-slate-500 uppercase font-bold text-[9px]">Expected</p>
                  <ul className="text-slate-300">
                    <li>normalized = Bronquiolite</li>
                    <li>canonical = Bronquiolite</li>
                    <li>lock = ACTIVE</li>
                  </ul>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <p className="text-slate-500 uppercase font-bold text-[9px]">Registrar</p>
                  <ul className="text-slate-300">
                    <li>session_id</li>
                    <li>context_hash</li>
                    <li>topic_locked_at</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-4">
              <h3 className="text-white font-bold border-b border-white/10 pb-2">TEST 2 — PERCORRER OS 15 BLOCOS</h3>
              <p className="text-slate-400">Avançar realmente pelos 15 blocos pedagógicos. Não simular outputs.</p>
              <div className="bg-rose-500/10 p-3 rounded border border-rose-500/20">
                <p className="text-rose-400 font-black uppercase text-[9px] mb-2 italic">ASSERT EM TODOS:</p>
                <code className="text-[10px] text-white space-y-1 block">
                  session_topic == Bronquiolite<br/>
                  prompt_topic == Bronquiolite<br/>
                  evidence_topic == Bronquiolite<br/>
                  output_topic == Bronquiolite
                </code>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
              <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mb-2 italic">CONTEÚDO ESPERADO</h3>
              <ul className="space-y-3 text-slate-400">
                <li><span className="text-white font-bold">Fisiopatologia:</span> pequenas vias aéreas, edema, muco, obstrução, V/Q.</li>
                <li><span className="text-white font-bold">Semiologia:</span> lactente, taquipneia, esforço respiratório, ausculta.</li>
                <li><span className="text-white font-bold">Diagnóstico/Conduta:</span> abordagem específica da Bronquiolite.</li>
              </ul>
              <div className="mt-4 p-2 bg-rose-500/5 border border-rose-500/20 rounded italic text-rose-400 text-[10px]">
                NÃO ACEITAR como PASS conteúdo predominantemente genérico ou drift para IC/Sepse/Trauma.
              </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-3">
              <h3 className="text-white font-bold border-b border-white/10 pb-2 italic">TEST 3, 4 & 5 — CONTINUITY & CHANGE</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="text-indigo-400">Continue:</span> Não deve mudar tema.</li>
                <li><span className="text-indigo-400">Diferencial:</span> "Como diferencio de asma?" -> Tema deve continuar Bronquiolite.</li>
                <li><span className="text-indigo-400">Mudança Explícita:</span> "Quero estudar IC" -> Deve atualizar lock.</li>
              </ul>
            </div>

            <div className="p-4 bg-black/40 border border-white/5 rounded-lg">
              <h3 className="text-white font-bold mb-4 italic">RELATÓRIO DE CERTIFICAÇÃO</h3>
              <div className="space-y-1 font-mono text-[9px] text-slate-500">
                <p>TOPIC LOCK E2E STATUS: <span className="text-indigo-500 underline decoration-dotted">PENDING</span></p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <p>BLOCK 01 .... [ ]</p>
                    <p>BLOCK 02 .... [ ]</p>
                    <p>BLOCK 03 .... [ ]</p>
                    <p>BLOCK 04 .... [ ]</p>
                    <p>BLOCK 05 .... [ ]</p>
                    <p>BLOCK 06 .... [ ]</p>
                    <p>BLOCK 07 .... [ ]</p>
                    <p>BLOCK 08 .... [ ]</p>
                  </div>
                  <div className="space-y-1">
                    <p>BLOCK 09 .... [ ]</p>
                    <p>BLOCK 10 .... [ ]</p>
                    <p>BLOCK 11 .... [ ]</p>
                    <p>BLOCK 12 .... [ ]</p>
                    <p>BLOCK 13 .... [ ]</p>
                    <p>BLOCK 14 .... [ ]</p>
                    <p>BLOCK 15 .... [ ]</p>
                    <p>STATUS .... ?/15</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest italic">
            NÃO FAÇA NOVOS HOTFIXES ANTES DE EXECUTAR ESTE TESTE.
          </p>
          <p className="text-[9px] text-white/20 mt-2">
            TOPIC LOCK E2E CERTIFICATION PROTOCOL V1.0 • ENAZIZI MEDICAL ENGINE
          </p>
        </footer>
      </div>
    </div>
  );
}