import { EnaflixLayout } from "@/components/enaflix/EnaflixLayout";
import { History } from "lucide-react";

const Historico = () => {
  return (
    <EnaflixLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <History className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Histórico de Atividade</h1>
        <p className="text-white/60 max-w-md mx-auto">
          Acompanhe sua jornada de estudos e reveja o conteúdo que você já consumiu.
        </p>
        <div className="mt-8 p-12 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <p className="text-white/40 italic">Seu histórico está vazio por enquanto.</p>
        </div>
      </div>
    </EnaflixLayout>
  );
};

export default Historico;
