import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona para o dashboard ou última sessão ativa
    navigate("/dashboard");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black uppercase tracking-widest text-white/40">
          P0 REAL TUTOR PATH RESTORED
        </p>
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">
          MEDICAL ENGINE ACTIVE
        </p>
      </div>
    </div>
  );
}
