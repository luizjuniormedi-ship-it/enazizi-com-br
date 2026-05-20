import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileText, ArrowLeft } from "lucide-react";

const Terms = () => {
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
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Termos de Uso</h1>
              <p className="text-white/40 text-sm">Última atualização: Maio de 2026</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/70 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma ENAZIZI, você concorda em cumprir estes Termos de Uso. Este é um contrato legal entre você e o ENAZIZI para o uso de nossos serviços educacionais baseados em Inteligência Artificial.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">2. Descrição do Serviço</h2>
              <p>
                O ENAZIZI fornece uma plataforma de preparação para exames médicos, incluindo bancos de questões, flashcards, geradores de conteúdo via IA e analytics de desempenho. O serviço é destinado exclusivamente a estudantes de medicina e médicos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">3. Responsabilidades do Usuário</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>O acesso é pessoal e intransferível. O compartilhamento de senhas resulta em bloqueio imediato da conta.</li>
                <li>Você se compromete a fornecer informações verídicas no cadastro.</li>
                <li>É proibido o uso de qualquer meio automatizado (bots, scrapers) para extrair conteúdo da plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">4. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo disponibilizado na plataforma (textos, questões comentadas, algoritmos de IA, design) é de propriedade exclusiva do ENAZIZI ou licenciado para tal. A reprodução sem autorização prévia é estritamente proibida.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">5. Isenção de Responsabilidade Médica</h2>
              <p className="bg-primary/5 border border-primary/20 p-4 rounded-lg italic">
                O ENAZIZI é uma ferramenta educacional. As informações aqui contidas não devem ser utilizadas como substituto para julgamento clínico profissional ou aconselhamento médico direto. Não nos responsabilizamos por decisões tomadas na prática médica baseadas nos conteúdos de estudo.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">6. Pagamentos e Cancelamento</h2>
              <p>
                Planos de assinatura são renovados automaticamente, a menos que o cancelamento seja solicitado via painel do usuário. O acesso continuará ativo até o final do período já pago.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white border-l-4 border-primary pl-4 mb-4">7. Modificações</h2>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão notificadas aos usuários ativos via e-mail ou aviso na plataforma.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
