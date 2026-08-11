import React from 'react';

export default function WarRoom() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono selection:bg-rose-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-4 border-b border-white/10 pb-8 text-center md:text-left">
          <div className="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 italic">P0 FORENSIC MODE</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
            WAR ROOM — REAL TUTOR <span className="text-rose-500">PROVIDER vs SAFE MODE</span>
          </h1>
          <p className="text-rose-500 text-sm font-bold uppercase tracking-widest animate-pulse">
            DO NOT MODIFY THE TUTOR BEFORE TRACE
          </p>
        </header>

        <section className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-6 space-y-4">
          <h2 className="text-rose-400 font-bold uppercase tracking-widest text-xs">INCIDENTE REAL</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-2">
              <p className="text-slate-400"><span className="text-white font-bold">Tela:</span> /dashboard/sessao-estudo/:sessionId</p>
              <div className="p-3 bg-black/40 rounded border border-white/5 space-y-1">
                <p className="text-white font-bold">Interface mostra:</p>
                <p className="text-emerald-400 italic">Tutor V3 Premium</p>
                <p className="text-indigo-400 font-bold">openai/gpt-5</p>
              </div>
            </div>
            <div className="p-3 bg-rose-500/10 rounded border border-rose-500/20 space-y-2">
              <p className="text-rose-200 font-bold">Ocorrência:</p>
              <p className="text-slate-300 italic">"🏥 Sistema em Modo de Resiliência: bronqueolite. O motor principal de IA está temporariamente indisponível..."</p>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5">
            <p className="text-white font-black uppercase text-[10px] text-center italic tracking-[0.2em]">
              UI LABEL vs REQUESTED vs EFFECTIVE vs SAFE MODE
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <section className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-6">
              <h2 className="text-indigo-400 font-bold uppercase tracking-widest text-xs mb-4">1 — NETWORK SOURCE OF TRUTH</h2>
              <div className="space-y-4 text-[11px]">
                <div className="p-3 bg-black/40 rounded border border-indigo-500/20">
                  <p className="text-indigo-300 font-bold mb-1 italic">Input para o teste:</p>
                  <code className="text-white">"Explique por que a bronquiolite causa sibilância."</code>
                </div>
                <div className="grid grid-cols-2 gap-4 text-slate-400">
                  <div className="space-y-1">
                    <p>FRONTEND ROUTE ..... ?</p>
                    <p>ENDPOINT ........... ?</p>
                    <p>HTTP STATUS ........ ?</p>
                  </div>
                  <div className="space-y-1">
                    <p>TRACE ID ........... ?</p>
                    <p>LATENCY (ms) ....... ?</p>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded text-[10px] text-rose-300 font-bold">
                  IF ENDPOINT == eu-ai {'->'} FAIL (Architectural Leak)
                </div>
              </div>
            </section>

            <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-6">
              <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-4">2 & 3 — BACKEND & PROVIDER TRACE</h2>
              <div className="space-y-4 text-[11px] text-slate-400 font-mono">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-white font-bold border-b border-white/10 pb-1">CONTEXT</p>
                    <p>Tutor-v3-premium ... [ ]</p>
                    <p>Session ID ......... ?</p>
                    <p>Canonical Topic .... ?</p>
                    <p>EvidencePack ....... [ ]</p>
                    <p>Contract Hash ...... ?</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-bold border-b border-white/10 pb-1">ATTEMPT 1</p>
                    <p>Provider ........... ?</p>
                    <p>Model .............. ?</p>
                    <p>HTTP ............... ?</p>
                    <p>Latency ............ ?ms</p>
                    <p>Result ............. ?</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-white font-bold">ATTEMPT 2</p>
                    <p>Provider ........... ?</p>
                    <p>Result ............. ?</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-bold">ATTEMPT 3</p>
                    <p>Provider ........... ?</p>
                    <p>Result ............. ?</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-6">
              <h2 className="text-amber-400 font-bold uppercase tracking-widest text-xs mb-4">4 — THE GPT-5 MYSTERY</h2>
              <div className="space-y-3 text-[10px] text-slate-400">
                <p>A UI afirma: <span className="text-indigo-400 font-bold">openai/gpt-5</span></p>
                <div className="p-2 bg-black/40 rounded border border-amber-500/20 space-y-1">
                  <p>REQUESTED = [ ]</p>
                  <p>CALLED = [ ]</p>
                  <p>CONTENT = [ ]</p>
                  <p>ERROR = ?</p>
                </div>
                <p className="text-rose-400 italic">Se GPT-5 não foi chamado: UI Badge is STALE/HARDCODED.</p>
              </div>
            </section>

            <section className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-6">
              <h2 className="text-rose-400 font-bold uppercase tracking-widest text-xs mb-4">5 — SAFE MODE ACTIVATION</h2>
              <div className="space-y-3 text-[10px] text-slate-400">
                <div className="p-2 bg-black/40 rounded border border-rose-500/20 space-y-1 font-mono">
                  <p>ACTIVE = [ ]</p>
                  <p>TRIGGER = ?</p>
                  <p>STAGE = ?</p>
                  <p>ELAPSED = ?ms</p>
                </div>
                <p className="text-rose-300 font-bold">ROOT CAUSES TO CHECK:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>PROVIDER_TIMEOUT</li>
                  <li>EMPTY_RESPONSE</li>
                  <li>GROUNDING_FAIL</li>
                  <li>GLOBAL_DEADLINE</li>
                </ul>
              </div>
            </section>
          </div>
        </div>

        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-white font-bold uppercase tracking-widest text-xs mb-4 text-center">RELATÓRIO OBRIGATÓRIO — FINAL DIAGNOSIS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] font-mono">
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">THE SCREEN IS:</span>
                <span className="text-white font-bold">REAL TUTOR / WRONG TUTOR</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">FUNCTIONAL ENDPOINT:</span>
                <span className="text-white font-bold">?</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">ACTUAL IA SOURCE:</span>
                <span className="text-white font-bold">?</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">GPT-5 BADGE:</span>
                <span className="text-rose-400 font-bold">REAL / STALE / HARDCODED</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">SAFE MODE ROOT CAUSE:</span>
                <span className="text-white font-bold">?</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">TOTAL LATENCY:</span>
                <span className="text-white font-bold">?ms</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-white/5 text-center space-y-2">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest italic animate-pulse">
            NÃO FAÇA NOVOS HOTFIXES ANTES DE EXECUTAR ESTE TRACE.
          </p>
          <p className="text-[9px] text-white/20">
            P0 FORENSIC PROTOCOL V1.2 • ENAZIZI MEDICAL INTELLIGENCE • AUGUST 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
