import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para o dashboard ou última sessão ativa
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl w-full text-center space-y-8 bg-slate-900/50 p-12 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
        
        <div className="space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white/90">
            WAR ROOM — P0 TUTOR SAFE MODE / BRONQUIOLITE FAILURE
          </h1>
          <div className="h-1 w-24 bg-indigo-500 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-white/5">
            <h2 className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Incidente Real</h2>
            <div className="space-y-2">
              <p className="text-xs text-white/40 font-mono">Input:</p>
              <p className="text-sm text-white/80 font-medium italic">"Quero estudar: bronqueolite"</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-white/40 font-mono">Output:</p>
              <p className="text-xs text-amber-500/90 leading-relaxed bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                "🏥 Sistema em Manutenção Cognitiva... Identificamos uma alta demanda no tema Medicina Geral... Em instantes, o Tutor V3 voltará..."
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-black/40 p-6 rounded-2xl border border-white/5">
            <h2 className="text-red-400 font-bold uppercase tracking-widest text-xs">Classificação P0</h2>
            <ul className="text-xs space-y-2 text-white/60 font-mono">
              <li className="flex gap-2">
                <span className="text-red-500">1.</span>
                <span>Topic Canonicalization Fail</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500">2.</span>
                <span>AI Runtime Silent Crash</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500">3.</span>
                <span>Contextual Fallback Leak (Medicina Geral)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-500">4.</span>
                <span>Misleading Error Messaging</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-[0.3em] animate-pulse">
            Tracing execution: bronqueolite → bronquiolite
          </p>
          <p className="text-[9px] text-white/20 mt-2 font-mono">
            MEDICAL ONTOLOGY LOCK ACTIVE • SHA-256 INTEGRITY CERTIFIED
          </p>
        </div>
      </div>
    </div>
  );
}
