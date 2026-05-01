import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  Clock, 
  BookOpen, 
  Stethoscope, 
  ChevronRight,
  Share2,
  Lock,
  Sparkles,
  Award,
  Video,
  Flame,
  Zap,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

const PublicVideoLesson = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["public-video-lesson", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();

      if (error) {
        toast.error("Erro ao carregar videoaula: " + error.message);
        throw error;
      }
      return data;
    }
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
      <div className="text-white/50 animate-pulse flex flex-col items-center gap-4">
        <Video className="h-12 w-12" />
        <p>Carregando preview da aula...</p>
      </div>
    </div>
  );

  if (!lesson) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-white">Conteúdo não disponível</h1>
        <p className="text-white/60">Esta videoaula é privada ou foi removida. Entre em contato com o suporte para mais informações.</p>
        <Button onClick={() => navigate("/")} variant="outline" className="w-full">Voltar para Home</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      {/* Header Público */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center font-bold text-lg">E</div>
            <span className="font-bold text-xl tracking-tight">ENAZIZI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-sm font-medium hover:text-primary" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold" asChild>
              <Link to="/register">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Lado Esquerdo: Player Preview & Detalhes */}
          <div className="lg:col-span-2 space-y-8">
            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-white/5 group">
              {lesson.thumbnail_url ? (
                <img 
                  src={lesson.thumbnail_url} 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                  alt={lesson.title}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/5">
                  <Stethoscope className="h-20 w-20 text-primary/20" />
                </div>
              )}
              
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/40 backdrop-blur-[2px]">
                <div className="h-24 w-24 bg-primary rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                  <Play className="h-10 w-10 text-white fill-white ml-1" />
                </div>
                <div className="text-center px-6">
                  <Badge className="bg-yellow-500 text-black mb-4 font-bold px-4 py-1">PREVIEW DISPONÍVEL</Badge>
                  <h3 className="text-xl font-bold">Faça login para assistir a aula completa</h3>
                  <p className="text-white/60 mt-2 max-w-sm mx-auto">
                    Acesso exclusivo para alunos ENAZIZI com Tutor IA, Feynman e ACE Engine.
                  </p>
                </div>
                <div className="flex gap-4 mt-2">
                   <Button size="lg" className="bg-primary font-bold px-8" asChild>
                     <Link to="/register">Matricule-se Agora</Link>
                   </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                  {lesson.specialty}
                </Badge>
                {lesson.is_gold_content && (
                  <Badge className="bg-yellow-500 text-black gap-1">
                    <Sparkles className="h-3 w-3" /> CONTEÚDO OURO
                  </Badge>
                )}
                <Badge variant="outline" className="border-orange-500/30 text-orange-500 gap-1">
                  <Flame className="h-3 w-3" /> EXAM SPRINT DISPONÍVEL
                </Badge>
                <span className="text-white/40 text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {Math.floor(lesson.duration_seconds / 60)} min
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
                {lesson.title}
              </h1>
              <div className="flex items-center gap-4 text-white/40 text-sm">
                <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Score CME: {lesson.cme_score || '8.8'}</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Retenção IA: 94%</span>
              </div>
              <p className="text-xl text-white/60 leading-relaxed">
                {lesson.topic} • {lesson.subtopic || 'Conteúdo de alta performance para residência médica.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    O que você vai aprender
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-white/60 space-y-2 text-sm">
                  <p>• Domínio profundo do tema baseado em evidências.</p>
                  <p>• Correlações clínicas essenciais para a prova.</p>
                  <p>• Raciocínio clínico médico estruturado.</p>
                  <p>• Pegadinhas de prova e hotspots de cobrança.</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Vantagens ENAZIZI
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-white/60 space-y-2 text-sm">
                  <p>• Tutor IA 24h para tirar dúvidas contextuais.</p>
                  <p>• Sistema Adaptativo ACE que entende sua fadiga.</p>
                  <p>• Retenção FSRS para nunca mais esquecer.</p>
                  <p>• Multimodalidade (Vídeo, Áudio, Texto, Quiz).</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Lado Direito: CTA & Informações Institucionais */}
          <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 shadow-2xl overflow-hidden sticky top-28">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="h-24 w-24 text-primary" />
              </div>
              <CardHeader className="relative">
                <CardTitle className="text-2xl font-bold">Domine a Medicina com IA</CardTitle>
                <CardDescription className="text-white/80">
                  Transforme seu estudo com a plataforma médica mais avançada do Brasil.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-primary/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm">Acesso a +1.000 videoaulas inteligentes.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-primary/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm">Banco com +100.000 questões comentadas.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 bg-primary/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm">Mentoria IA personalizada por especialidade.</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <Button className="w-full bg-primary hover:bg-primary/90 h-12 text-lg font-bold shadow-lg" asChild>
                    <Link to="/register">Assinar Agora</Link>
                  </Button>
                  <Button variant="outline" className="w-full border-white/20 hover:bg-white/5 h-12" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copiado!");
                  }}>
                    <Share2 className="h-4 w-4 mr-2" /> Compartilhar Aula
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="px-2 text-center">
              <p className="text-xs text-white/40 italic">
                A tecnologia ENAZIZI utiliza algoritmos proprietários de neurociência e ciência cognitiva para maximizar sua aprovação.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Simples */}
      <footer className="mt-20 border-t border-white/5 py-12 text-center text-white/40">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm">© 2026 ENAZIZI — Sistema Operacional Cognitivo Médico. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

// Placeholder icon for BrainCircuit which might be missing from the lucide-react version
const BrainCircuit = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.245 4 4 0 0 0 7.837 1.86" />
    <path d="M9 13a4.5 4.5 0 0 0 3-4" />
    <path d="M6.003 5.125A3 3 0 0 0 12 5" />
    <path d="M12 16a5 5 0 0 1 10-5" />
    <path d="M15 13a2 2 0 1 0 2 2" />
    <path d="M19 7a2 2 0 1 0 2 2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 14v4" />
    <circle cx="12" cy="19" r="1" />
    <path d="M16 12h4" />
    <circle cx="21" cy="12" r="1" />
    <path d="M12 10V6" />
    <circle cx="12" cy="5" r="1" />
    <path d="M8 12H4" />
    <circle cx="3" cy="12" r="1" />
  </svg>
);

export default PublicVideoLesson;
