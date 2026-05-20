import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield, ArrowLeft } from "lucide-react";

const Privacy = () => {
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
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Política de Privacidade</h1>
              <p className="text-white/40 text-sm">Última atualização: Maio de 2026</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/70 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">1. Compromisso com a Privacidade</h2>
              <p>
                O ENAZIZI valoriza a privacidade de seus usuários. Esta política descreve como coletamos, usamos e protegemos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">2. Dados Coletados</h2>
              <p>Coletamos informações essenciais para a prestação dos nossos serviços educacionais:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informações de Cadastro:</strong> Nome completo, e-mail, telefone e instituição de ensino.</li>
                <li><strong>Dados de Desempenho:</strong> Respostas de simulados, histórico de erros, progresso em flashcards e tempo de estudo para otimização do algoritmo de IA.</li>
                <li><strong>Logs Técnicos:</strong> Endereço IP, tipo de navegador e dados de navegação para segurança e melhoria da performance.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">3. Finalidade do Tratamento</h2>
              <p>Seus dados são utilizados para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Personalizar seu plano de estudos através da nossa Inteligência Artificial.</li>
                <li>Garantir o acesso seguro à plataforma.</li>
                <li>Enviar comunicações sobre seu progresso e atualizações críticas do sistema.</li>
                <li>Realizar análises estatísticas anônimas para melhoria contínua do ecossistema ENAZIZI.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">4. Seus Direitos</h2>
              <p>Como titular dos dados, você tem direito a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Confirmar a existência de tratamento de seus dados.</li>
                <li>Acessar seus dados pessoais a qualquer momento.</li>
                <li>Corrigir dados incompletos ou inexatos.</li>
                <li>Solicitar a exclusão de seus dados (observadas as obrigações legais de manutenção).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">5. Segurança</h2>
              <p>
                Implementamos medidas técnicas de segurança, como criptografia de ponta a ponta e auditorias regulares, para proteger seus dados contra acessos não autorizados e situações acidentais de destruição ou alteração.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">6. Contato</h2>
              <p>
                Para exercer seus direitos ou tirar dúvidas, entre em contato com nosso Encarregado de Dados (DPO) através do e-mail: <span className="text-primary">privacidade@enazizi.com.br</span>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
