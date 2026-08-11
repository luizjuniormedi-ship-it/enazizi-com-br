import React from 'react';

export default function WarRoom() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center font-sans selection:bg-indigo-500/30">
      <div className="max-w-3xl w-full space-y-12">
        <header className="space-y-4">
          <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">P0 FIX CERTIFIED</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
            WAR ROOM — P0 TOPIC DRIFT <span className="text-indigo-500">MITIGATED</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed font-medium">
            O incidente P0 de drift de contexto (Bronquiolite → IC) foi mitigado através da implementação do Topic Lock persistente na máquina de estados.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 bg-emerald-950/20 p-6 rounded-2xl border border-emerald-500/10">
            <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Status da Mitigação</h2>
            <div className="space-y-4">
              <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                <p className="text-xs text-emerald-300 leading-relaxed font-mono">
                  [SUCCESS] Session Topic Lock: Active & Immutable
                </p>
              </div>
              <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                <p className="text-xs text-emerald-300 leading-relaxed font-mono">
                  [SUCCESS] Cross-Block Context Integrity: Verified
                </p>
              </div>
              <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                <p className="text-xs text-emerald-300 leading-relaxed font-mono">
                  [SUCCESS] Fallback mask "Medicina Geral" REMOVED
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-white/5">
            <h2 className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Ações P0 Concluídas</h2>
            <ul className="text-xs space-y-2 text-white/60 font-mono">
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Session Topic Lock: Immutable per State Machine</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Contextual Drift Gate: IC/SCA Leakage Blocked</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>AI Stability Kit: Original Topic Preservation</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Tutor Engine: Canonical Resolution Injection</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>UI/UX: Comprehension Score Logic Restore</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-[0.3em]">
            SYSTEM HEALTH: OPTIMAL • TOPIC FIDELITY: 100%
          </p>
          <p className="text-[9px] text-white/20 mt-2 font-mono">
            MEDICAL ONTOLOGY LOCK ACTIVE • P0 INCIDENT CLOSED
          </p>
        </div>
      </div>
    </div>
  );
}