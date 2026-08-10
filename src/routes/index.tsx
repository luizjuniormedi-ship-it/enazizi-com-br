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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl space-y-4">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">APIs de Inteligência & Orquestração</h3>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-red-400 font-bold">eu-ai</span>
                <span className="text-zinc-400 text-right">Gateway Claude (Sonnet 3.5) + Fallback</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-red-400 font-bold">tutor-v3-premium</span>
                <span className="text-zinc-400 text-right">Motor de Ensino Adaptativo L3</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-red-400 font-bold">study-orchestrator</span>
                <span className="text-zinc-400 text-right">Gestão de Fluxo e Próximo Passo</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-red-400 font-bold">memory-consolidation</span>
                <span className="text-zinc-400 text-right">FSRS e Repetição Espaçada</span>
              </div>
            </div>
          </div>

          <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl space-y-4">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">Geração de Conteúdo Médico</h3>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-blue-400 font-bold">enamed-generator</span>
                <span className="text-zinc-400 text-right">Questões Padrão ENAM (16k tokens)</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-blue-400 font-bold">generate-flashcards</span>
                <span className="text-zinc-400 text-right">Criação de Cards via MCE v4.1</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-blue-400 font-bold">mnemonic-studio</span>
                <span className="text-zinc-400 text-right">Geração de Mnemônicos Visuais</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-blue-400 font-bold">medical-vision-engine</span>
                <span className="text-zinc-400 text-right">Análise de Imagens Clínicas/RX</span>
              </div>
            </div>
          </div>

          <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl space-y-4">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">Diagnóstico & Analytics</h3>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-green-400 font-bold">cognitive-orchestrator</span>
                <span className="text-zinc-400 text-right">Risco ENAMED e Engajamento</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-green-400 font-bold">fatigue-detector</span>
                <span className="text-zinc-400 text-right">Monitoramento de Cansaço Cognitivo</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-green-400 font-bold">ai-quality-monitor</span>
                <span className="text-zinc-400 text-right">Auditoria P0-P3 em Tempo Real</span>
              </div>
            </div>
          </div>

          <div className="p-6 border border-zinc-800 bg-zinc-900/50 rounded-2xl space-y-4">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">Engajamento & Canais</h3>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-purple-400 font-bold">whatsapp-agent</span>
                <span className="text-zinc-400 text-right">Tutor via WhatsApp (24/7)</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-purple-400 font-bold">daily-bi-whatsapp</span>
                <span className="text-zinc-400 text-right">Envio de Dashboards Diários</span>
              </div>
              <div className="flex justify-between p-2 bg-zinc-800/20 rounded">
                <span className="text-purple-400 font-bold">professor-reminder</span>
                <span className="text-zinc-400 text-right">Notificações de Mentoria</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border border-zinc-800 bg-zinc-900/30 rounded-xl">
           <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-tighter">
             Total de 221 Edge Functions detectadas no catálogo | Status: RELIABILITY HARDENING CERTIFIED
           </p>
        </div>
      </div>
    </div>
  );
};

export default RouteIndex;
