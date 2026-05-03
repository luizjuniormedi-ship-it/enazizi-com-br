import { useEffect, useState } from "react";
import { useEducationalMemory } from "@/hooks/useEducationalMemory";
import { EnaflixOverlayNav } from "@/components/enaflix/EnaflixOverlayNav";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionRowVideo } from "@/components/enaflix/EnaflixSectionRowVideo";
import { useNavigate } from "react-router-dom";
import { Brain, History, Star, Video, FileText, Search, Filter, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function MyLessonsPage() {
  const navigate = useNavigate();
  const { memory, isLoading } = useEducationalMemory();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Minhas Aulas — ENAFLIX";
  }, []);

  const lessons = memory.map(m => ({
    ...m,
    specialty: m.subject || "Geral",
    duration_seconds: m.duration || 900,
    progress: m.status === 'published' ? 100 : 0
  }));

  const filteredLessons = lessons.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const continueLessons = filteredLessons.filter(m => m.status === 'published' && !m.archived).slice(0, 10);
  const favorites = filteredLessons.filter(m => m.is_favorite);
  const inProduction = filteredLessons.filter(m => ['pending_review', 'in_production', 'ready_to_publish'].includes(m.status));
  const library = filteredLessons.filter(m => m.status === 'published' && !m.is_favorite);

  const handleClose = () => navigate("/dashboard");

  return (
    <div className="min-h-screen bg-[#050508] text-white relative overflow-x-hidden">
      <EnaflixBackgroundFX intensity="medium" />

      <EnaflixOverlayNav onClose={handleClose} />

      <main className="pt-24 pb-20 px-4 sm:px-8 lg:px-14 relative z-10 space-y-16">
        
        {/* Header Hero Section */}
        <header className="relative py-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-8"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-primary/20 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <Badge variant="outline" className="bg-white/5 border-white/10 text-primary font-black tracking-widest text-[10px] uppercase py-1">
                  Cloud Memory v2.4
                </Badge>
              </div>
              <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none">
                Minha <span className="text-primary">Memória</span> <br className="hidden sm:block" /> Educacional
              </h1>
              <p className="text-white/40 text-lg sm:text-xl font-medium max-w-2xl leading-relaxed">
                Aulas personalizadas, sessões do tutor e conteúdos cinematográficos gerados pela sua IA.
              </p>
            </div>

            {/* Stats / Quick Search */}
            <div className="flex flex-col gap-4 w-full md:w-auto">
               <div className="flex gap-4">
                 <div className="flex-1 md:w-64 relative group">
                    <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                    <input 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar na memória..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                 </div>
                 <button className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <Filter className="h-6 w-6 text-white/40" />
                 </button>
               </div>
            </div>
          </motion.div>
        </header>

        {/* Sections Grid */}
        <div className="space-y-20 pb-20">
          {continueLessons.length > 0 && (
            <EnaflixSectionRowVideo 
              title="Continuar Estudando" 
              subtitle="Retome sua jornada de onde parou"
              lessons={continueLessons} 
            />
          )}

          {favorites.length > 0 && (
            <EnaflixSectionRowVideo 
              title="Aulas Favoritas" 
              subtitle="Seus conteúdos premium salvos"
              lessons={favorites} 
            />
          )}

          {inProduction.length > 0 && (
            <EnaflixSectionRowVideo 
              title="CME em Produção" 
              subtitle="Aguarde o processamento da nossa GPU Cloud"
              lessons={inProduction} 
            />
          )}

          {library.length > 0 && (
            <EnaflixSectionRowVideo 
              title="Biblioteca Geral" 
              subtitle="Conteúdo médico sob demanda"
              lessons={library} 
            />
          )}

          {lessons.length === 0 && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-32 rounded-[40px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Search className="w-16 h-16 text-white/10 mx-auto mb-6" />
              <h3 className="text-2xl font-black mb-3">Memória em Branco</h3>
              <p className="text-white/30 max-w-md mx-auto font-medium">
                Sua IA ainda não gerou aulas personalizadas. Experimente perguntar algo ao Tutor Premium!
              </p>
              <button 
                onClick={() => navigate("/dashboard/mentor")}
                className="mt-8 px-8 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform"
              >
                Ativar Tutor IA
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
