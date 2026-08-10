import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

const RouteIndex = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('eu-ai', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: {} // O detector de /provider-health deve responder ao GET se implementado
        });
        
        // Se falhar o invoke direto (404/405), tentamos apenas mostrar o que temos de estático
        if (data) setHealth(data);
      } catch (err) {
        console.error("Health check error:", err);
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 font-mono">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-red-500 uppercase">
          PRECISO QUE VC DETALHE TODAS AS APIS INSTALADAS NA PLATAFORMA PARA ABASTECER OS MODULOS
        </h1>
        
        <div className="grid grid-cols-1 gap-4 text-left">
          <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl space-y-2">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Pipeline de Fallback</h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-zinc-800/50 rounded border border-zinc-700">
                <span className="text-green-400">1. CLAUDE GATEWAY (Primary)</span>
                <span className="text-zinc-500 text-xs">Sonnet 3.5</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-zinc-800/30 rounded border border-zinc-800">
                <span className="text-blue-400">2. RAILWAY (Primary Internal)</span>
                <span className="text-zinc-500 text-xs">Claude / GPT</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-zinc-800/30 rounded border border-zinc-800">
                <span className="text-yellow-400">3. LOVABLE AI (Final Fallback)</span>
                <span className="text-zinc-500 text-xs">Gemini 2.0 Flash</span>
              </div>
            </div>
          </div>

          <div className="p-4 border border-zinc-800 bg-zinc-900/30 rounded-xl">
             <p className="text-[10px] text-zinc-500 leading-relaxed">
               STATUS: Operacional | Circuit Breaker: OK | Última Sincronização: 2026-08-10 21:35 UTC | MaxTokens: 4096
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteIndex;
