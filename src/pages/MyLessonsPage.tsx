import { useEffect } from "react";
import { useEducationalMemory } from "@/hooks/useEducationalMemory";
import { EnaflixOverlayNav } from "@/components/enaflix/EnaflixOverlayNav";
import { EnaflixAmbientParticles } from "@/components/enaflix/EnaflixAmbientParticles";
import { EnaflixSectionRow } from "@/components/enaflix/EnaflixSectionRow";
import { useNavigate } from "react-router-dom";
import { Brain, History, Star, Video, FileText, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function MyLessonsPage() {
  const navigate = useNavigate();
  const { memory, isLoading } = useEducationalMemory();

  useEffect(() => {
    document.title = "Minhas Aulas — ENAFLIX";
  }, []);

  const continueLessons = memory.filter(m => !m.archived).slice(0, 10);
  const favorites = memory.filter(m => m.favorite);
  const cmeLessons = memory.filter(m => m.source_type === 'cme');
  const tutorLessons = memory.filter(m => m.source_type === 'tutor_chat');

  const handleClose = () => navigate("/dashboard");

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <EnaflixAmbientParticles count={20} hue="violet" />
      </div>

      <EnaflixOverlayNav onClose={handleClose} />

      <main className="pt-24 pb-20 px-4 sm:px-8 lg:px-14 relative z-10">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Minha Memória Educacional
            </h1>
          </div>
          <p className="text-white/50 text-lg max-w-2xl">
            Todas as suas aulas, sessões do tutor e conteúdos gerados pela IA organizados em um só lugar.
          </p>
        </header>

        <section className="space-y-16">
          {/* Continuar Estudando */}
          {continueLessons.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h2 className="text-2xl font-bold">Continuar Estudando</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {continueLessons.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          )}

          {/* Favoritos */}
          {favorites.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <h2 className="text-2xl font-bold">Favoritas</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {favorites.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          )}

          {/* Por Tipo: CME */}
          {cmeLessons.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <h2 className="text-2xl font-bold">Cinemática (CME)</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {cmeLessons.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          )}

          {/* Por Tipo: Tutor */}
          {tutorLessons.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">Conversas com Tutor</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {tutorLessons.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          )}

          {memory.length === 0 && !isLoading && (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
              <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Nenhuma aula memorizada ainda</h3>
              <p className="text-white/40 max-w-md mx-auto">
                Comece a usar o Tutor IA ou gere uma aula CME para que ela apareça aqui automaticamente.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: any }) {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (lesson.status === 'published' && lesson.id) {
      navigate(`/dashboard/videoaulas/${lesson.id}`);
    } else if (lesson.source_session_id) {
      navigate(`/dashboard/chatgpt?sessionId=${lesson.source_session_id}`);
    } else if (lesson.source_type === 'cme' && lesson.aggregation_id) {
      navigate(`/dashboard/videoaulas?aggregationId=${lesson.aggregation_id}`);
    } else if (lesson.source_type === 'tutor_chat' && lesson.session_id) {
      navigate(`/dashboard/chatgpt?sessionId=${lesson.session_id}`);
    }
  };


  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'cme': return <Video className="w-3 h-3" />;
      case 'tutor_chat': return <Brain className="w-3 h-3" />;
      case 'pdf': return <FileText className="w-3 h-3" />;
      default: return <Brain className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (type: string) => {
    switch (type) {
      case 'cme': return 'CME';
      case 'tutor_chat': return 'Tutor';
      case 'pdf': return 'PDF';
      default: return 'Aula';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_review': return 'Aguardando revisão';
      case 'in_production': return 'Em produção';
      case 'published': return 'Assistir';
      case 'rejected': return 'Não aprovada';
      default: return null;
    }
  };

  return (

    <Card 
      onClick={handleOpen}
      className="group relative bg-[#1a1a2e]/50 border-white/5 hover:border-primary/50 transition-all duration-500 cursor-pointer overflow-hidden backdrop-blur-sm"
    >
      <div className="aspect-video relative overflow-hidden">
        {lesson.thumbnail_url ? (
          <img 
            src={lesson.thumbnail_url} 
            alt={lesson.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
            <Brain className="w-12 h-12 text-white/10 group-hover:text-primary/40 transition-colors duration-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        
        <div className="absolute top-3 left-3">
          <Badge className="bg-black/60 backdrop-blur-md border-white/10 flex items-center gap-1.5 py-1">
            {getSourceIcon(lesson.source_type)}
            <span>{getSourceLabel(lesson.source_type)}</span>
          </Badge>
        </div>

        {lesson.status && lesson.status !== 'published' && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-amber-500/80 backdrop-blur-md border-white/10 text-[9px] py-0.5 px-1.5">
              {getStatusLabel(lesson.status)}
            </Badge>
          </div>
        )}

        {lesson.favorite && (
          <div className="absolute top-3 right-3">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="text-xs font-bold text-primary/80 uppercase tracking-wider">
            {lesson.subject || 'Medicina'}
          </div>
          <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {lesson.title}
          </h3>
          <p className="text-xs text-white/40 line-clamp-2">
            {lesson.short_summary || lesson.topic || 'Sem descrição.'}
          </p>
          
          <div className="pt-3 flex items-center justify-between text-[10px] text-white/30 uppercase font-bold tracking-widest border-t border-white/5">
            <span>{lesson.difficulty_level || 'Médio'}</span>
            <span>{Math.floor(lesson.estimated_duration / 60) || 15} MIN</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
