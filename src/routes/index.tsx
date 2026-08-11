import React from 'react';

export default function WarRoom() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono selection:bg-rose-500/30">
      <div className="max-w-4xl mx-auto space-y-8 text-[11px] leading-relaxed">
        <header className="space-y-4 border-b border-white/10 pb-8 text-center md:text-left">
          <div className="inline-block px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 italic">P0 ARCHITECTURAL AUDIT</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">
            WAR ROOM — P0 TUTOR <span className="text-rose-500">SINGLE-RESPONSE ARCHITECTURE AUDIT</span>
          </h1>
          <p className="text-rose-400 text-xs font-bold uppercase tracking-[0.2em]">
            DUPLICATE RESPONSE + SAFE MODE RACE + PEDAGOGICAL STATE CORRUPTION
          </p>
        </header>

        <section className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-rose-400 font-black uppercase tracking-widest text-[10px]">INCIDENTE REAL — IAM ANALYSIS</h2>
            <span className="text-rose-500 font-bold italic animate-pulse">SEVERIDADE: P0</span>
          </div>
          
          <div className="space-y-4">
            <p className="text-slate-300">
              Sim. Esse novo exemplo mostra que <span className="text-white font-bold underline decoration-rose-500/50">o problema agora é de arquitetura de resposta duplicada</span>, não mais de interpretação de IAM.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/40 rounded border border-emerald-500/20 space-y-2">
                <p className="text-emerald-400 font-black uppercase text-[9px]">RESPOSTA A (08:31)</p>
                <p className="text-white font-bold italic">"🫀 Infarto Agudo do Miocárdio (Premium Fallback)"</p>
                <p className="text-slate-400 text-[10px]">Conteúdo clínico (MONA, tempos) + Pergunta socrática.</p>
              </div>
              <div className="p-4 bg-black/40 rounded border border-rose-500/20 space-y-2">
                <p className="text-rose-400 font-black uppercase text-[9px]">RESPOSTA B (08:31)</p>
                <p className="text-white font-bold italic">"🏥 Sistema em Modo de Resiliência: iam"</p>
                <p className="text-slate-400 text-[10px]">"O motor principal de IA está temporariamente indisponível..."</p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-200 italic">
              "E depois ainda ativou o Gating Pedagógico. Isso é incorreto. Uma mensagem do usuário deve produzir **um único outcome terminal**."
            </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 overflow-x-auto">
          <h2 className="text-white font-black uppercase tracking-widest text-[10px] border-b border-white/10 pb-2">
            OBJETIVO ARQUITETURAL & CONTRATO
          </h2>
          <div className="space-y-4 font-mono text-[10px]">
            <div className="p-4 bg-black/60 border border-indigo-500/30 rounded text-center">
              <p className="text-indigo-300 font-bold mb-2">TARGET STATE:</p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-white">
                <span className="px-2 py-1 bg-white/10 rounded">1 USER MESSAGE</span>
                <span className="text-slate-500">→</span>
                <span className="px-2 py-1 bg-white/10 rounded">1 AI EXECUTION</span>
                <span className="text-slate-500">→</span>
                <span className="px-2 py-1 bg-white/10 rounded">N ATTEMPTS</span>
                <span className="text-slate-500">→</span>
                <span className="px-2 py-1 bg-indigo-500/40 rounded font-black italic">1 WINNER (EXATAMENTE UM)</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-rose-400 font-bold uppercase underline">DIAGNÓSTICOS A SEREM PROVADOS:</p>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  <li>Duas chamadas backend p/ mesma mensagem</li>
                  <li>Race condition: Fallback vence, Primary chega tarde</li>
                  <li>Retry criando novo assistant turn em vez de replace</li>
                  <li>Optimistic message + Realtime INSERT duplicando</li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="text-emerald-400 font-bold uppercase underline">ESTRATÉGIA DE CURA:</p>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  <li>Single Coordinator Ownership (Authority)</li>
                  <li>State Machine: PENDING → [PROCESSING] → TERMINAL</li>
                  <li>Compare-and-Set (CAS) p/ Winner Selection</li>
                  <li>Idempotency Guard via execution_id</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-black uppercase tracking-widest text-[10px] mb-4 text-center">TUTOR EXECUTION ROADMAP (FASES 1-20)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[9px] font-mono">
            {[
              { id: 'F1', title: 'IDENTIFY SOURCES', status: 'PENDING' },
              { id: 'F2', title: 'TRACE DUPLICATION', status: 'PENDING' },
              { id: 'F3', title: 'SINGLE OWNERSHIP', status: 'PENDING' },
              { id: 'F4', title: 'ABORT LOSERS', status: 'PENDING' },
              { id: 'F5', title: 'IDEMPOTENCY LOCK', status: 'PENDING' },
              { id: 'F6', title: 'REALTIME DEDUPE', status: 'PENDING' },
              { id: 'F7', title: 'FALLBACK HIERARCHY', status: 'PENDING' },
              { id: 'F8', title: 'PREMIUM SOURCE AUDIT', status: 'PENDING' },
              { id: 'F9', title: 'SAFE MODE GATING', status: 'PENDING' },
              { id: 'F10', title: 'PEDAGOGICAL GATING', status: 'PENDING' },
              { id: 'F11', title: 'ASSET GATING (FSRS)', status: 'PENDING' },
              { id: 'F12', title: 'TOPIC DISPLAY FIX', status: 'PENDING' },
              { id: 'F13', title: 'BADGE TRUTHFULNESS', status: 'PENDING' },
              { id: 'F14', title: 'REMOVE INFRA LOGS', status: 'PENDING' },
              { id: 'F15', title: 'IAM CONTENT AUDIT', status: 'PENDING' },
              { id: 'F16', title: '20 CONCURRENCY TESTS', status: 'PENDING' },
              { id: 'F17', title: 'LATE RESPONSE TEST', status: 'PENDING' },
              { id: 'F18', title: 'SAFE MODE LOGIC', status: 'PENDING' },
              { id: 'F19', title: 'PERFORMANCE p95', status: 'PENDING' },
              { id: 'F20', title: 'OBSERVABILITY', status: 'PENDING' }
            ].map(f => (
              <div key={f.id} className="flex justify-between items-center p-2 bg-black/20 border border-white/5 rounded">
                <span className="text-slate-500 font-bold">{f.id}</span>
                <span className="text-white mx-2">{f.title}</span>
                <span className="text-slate-600 italic">[{f.status}]</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-white font-black uppercase tracking-widest text-[10px] mb-4 text-center">CRITÉRIOS DE ACEITE OBRIGATÓRIOS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[10px] font-mono">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">ONE USER MESSAGE = ONE RESPONSE:</span>
                <span className="text-white font-bold">REQUIRED</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">DUPLICATE TERMINAL RESPONSES:</span>
                <span className="text-rose-500 font-bold">0</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">SAFE MODE AFTER FALLBACK SUCCESS:</span>
                <span className="text-rose-500 font-bold">0</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">LATE RESPONSES RENDERED:</span>
                <span className="text-rose-500 font-bold">0</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">PROVIDER BADGE TRUTHFULNESS:</span>
                <span className="text-white font-bold">REQUIRED</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">CONCURRENCY TEST PASS RATE:</span>
                <span className="text-white font-bold">20/20</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">FSRS ON INVALID RESPONSE:</span>
                <span className="text-rose-500 font-bold">0</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">FINAL STATUS:</span>
                <span className="text-rose-500 font-bold">NOT CERTIFIED</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-white/5 text-center space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded max-w-2xl mx-auto">
            <p className="text-rose-400 font-black uppercase text-[10px] tracking-[0.3em] mb-2">REGRA FINAL</p>
            <p className="text-white font-bold text-xs uppercase leading-normal italic">
              "NÃO CRIE OUTRO PATCH PARA IAM. O DEFEITO É ARQUITETURAL. UMA PERGUNTA. UMA EXECUÇÃO. UMA RESPOSTA FINAL."
            </p>
          </div>
          <p className="text-[9px] text-white/20 uppercase tracking-widest">
            P0 SINGLE-RESPONSE ARCHITECTURE AUDIT • ENAZIZI MEDICAL CORE • AUGUST 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
