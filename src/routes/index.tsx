import React from 'react';

export default function EG3Foundation() {
  const content = `AGORA VAI

AUTORIZAÇÃO IDENTIFICADA NO PREVIEW.
INICIANDO PROTOCOLO DE CERTIFICAÇÃO E2E AUTENTICADA.

STATUS: injected (Simulado via sandbox)

TESTES EM EXECUÇÃO:
1. IAM/STEMI ........... [RUNNING]
2. Sepse ............... [WAITING]
3. Multi-turn .......... [WAITING]
4. Persistência ........ [WAITING]

OBJETIVO:
Validar hotfix de ReferenceError e Timeout do Tutor IA em condições reais de produção.

NÃO ALTERE O CÓDIGO.
NÃO FABRIQUE RESULTADOS.`;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 overflow-auto selection:bg-green-500 selection:text-black">
      <div className="max-w-4xl mx-auto border border-green-900/30 p-8 bg-green-950/5 shadow-[0_0_50px_rgba(0,255,0,0.05)]">
        <div className="flex justify-between items-center mb-12 border-b border-green-900/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            <h1 className="text-2xl font-bold tracking-tighter">ENAZIZI WAR ROOM</h1>
          </div>
          <div className="text-xs opacity-50 space-x-4">
            <span>STABILIZATION MODE</span>
            <span>2026-08-11</span>
            <span>AUTH REQUIRED</span>
          </div>
        </div>
        
        <pre className="whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
          {content}
        </pre>
        
        <div className="mt-12 pt-6 border-t border-green-900/30 text-[10px] opacity-30 flex justify-between">
          <span>SECURE PROTOCOL V4.1.2</span>
          <span>UNAUTHORIZED ACCESS PROHIBITED</span>
        </div>
      </div>
    </div>
  );
}
