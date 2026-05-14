import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#050508] relative flex flex-col">
      <EnaflixBackgroundFX intensity="subtle" />
      
      <header className="border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl z-20">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-white">ENAZIZI</span>
          </Link>
          <Button variant="ghost" asChild className="text-white/60 hover:text-white">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-20 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">Termos de Uso</h1>
          </div>
          
          <div className="card-pixar p-8 bg-white/5 border-white/10 backdrop-blur-xl prose prose-invert max-w-none">
            <p className="text-white/60 leading-relaxed">
              Esta página está em construção. Em breve os termos completos estarão disponíveis.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-10 text-center relative z-10">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
          © {new Date().getFullYear()} ENAZIZI. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default Terms;
