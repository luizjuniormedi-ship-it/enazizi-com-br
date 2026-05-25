import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Mail, Phone, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

const Support = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#050508] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-primary hover:text-primary/80 transition-colors mb-8 group gap-2"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Voltar</span>
        </button>

        <div className="glass-card p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <LifeBuoy className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Central de Suporte</h1>
              <p className="text-white/40 text-sm">Estamos aqui para ajudar na sua jornada médica</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-pixar p-6 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">E-mail</h3>
              <p className="text-sm text-white/60">Envie suas dúvidas para nosso time técnico.</p>
              <Button asChild variant="outline" className="w-full">
                <a href="mailto:contato@enazizi.com.br">contato@enazizi.com.br</a>
              </Button>
            </div>

            <div className="card-pixar p-6 space-y-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-bold">WhatsApp</h3>
              <p className="text-sm text-white/60">Suporte rápido via chat para assinantes Premium.</p>
              <Button variant="outline" className="w-full border-green-500/50 text-green-500 hover:bg-green-500/10">
                Iniciar Conversa
              </Button>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-white/70">
            <p>
              Nosso horário de atendimento é de segunda a sexta, das 08h às 20h. 
              Para problemas técnicos de acesso, por favor inclua seu e-mail de cadastro e uma captura de tela do erro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;