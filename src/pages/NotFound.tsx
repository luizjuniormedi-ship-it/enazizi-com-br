import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] relative p-6">
      <div className="text-center space-y-6 relative z-10">
        <h1 className="text-9xl font-black text-primary/20 tracking-tighter">404</h1>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Página não encontrada</h2>
          <p className="text-white/40 font-medium max-w-xs mx-auto">
            A página que você procura não existe ou foi movida.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs">
            <Link to="/dashboard">Ir para o Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs border-white/10 text-white/60 hover:text-white">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
