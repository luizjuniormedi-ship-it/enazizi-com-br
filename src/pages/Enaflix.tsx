import { useState, useEffect, useMemo } from "react";
import { Play, BookOpen, Clock, Search, Filter, CheckCircle, Sparkles, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface EnaflixContent {
  id: string;
  title: string;
  description: string | null;
  specialty: string;
  content_type: string;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  difficulty: string;
  tags: string[];
  order_index: number;
}

interface EnaflixProgressEntry {
  content_id: string;
  watched: boolean;
  progress_percent: number;
}

const SPECIALTIES = [
  "Todas", "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Nefrologia", "Infectologia", "Hematologia",
  "Reumatologia", "Dermatologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia Geral", "Ortopedia", "Urologia", "Psiquiatria",
  "Medicina Preventiva", "Medicina de Emergência", "Clínica Médica",
];

const TYPE_ICONS: Record<string, typeof Play> = {
  video: Play,
  resumo: BookOpen,
  aula: Sparkles,
  artigo: BookOpen,
  podcast: Play,
};

const TYPE_COLORS: Record<string, string> = {
  video: "bg-red-500/10 text-red-500",
  resumo: "bg-blue-500/10 text-blue-500",
  aula: "bg-purple-500/10 text-purple-500",
  artigo: "bg-green-500/10 text-green-500",
  podcast: "bg-amber-500/10 text-amber-500",
};

const Enaflix = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [contents, setContents] = useState<EnaflixContent[]>([]);
  const [progress, setProgress] = useState<Map<string, EnaflixProgressEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("Todas");
  const [selectedType, setSelectedType] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [contentRes, progressRes] = await Promise.all([
          supabase.from("enaflix_content").select("*").eq("is_published", true).order("order_index"),
          supabase.from("enaflix_progress").select("content_id, watched, progress_percent").eq("user_id", user.id),
        ]);

        if (contentRes.error) throw contentRes.error;
        setContents(contentRes.data || []);

        const progressMap = new Map<string, EnaflixProgressEntry>();
        (progressRes.data || []).forEach((p) => progressMap.set(p.content_id, p));
        setProgress(progressMap);
      } catch (err) {
        console.error("Erro ao carregar ENAFLIX:", err);
        toast({ title: "Erro", description: "Não foi possível carregar o conteúdo.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filteredContents = useMemo(() => {
    return contents.filter((c) => {
      const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.specialty.toLowerCase().includes(search.toLowerCase()) || (c.description || "").toLowerCase().includes(search.toLowerCase());
      const matchSpecialty = selectedSpecialty === "Todas" || c.specialty === selectedSpecialty;
      const matchType = selectedType === "todos" || c.content_type === selectedType;
      return matchSearch && matchSpecialty && matchType;
    });
  }, [contents, search, selectedSpecialty, selectedType]);

  const totalWatched = Array.from(progress.values()).filter((p) => p.watched).length;
  const overallProgress = contents.length > 0 ? Math.round((totalWatched / contents.length) * 100) : 0;

  const markAsWatched = async (contentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("enaflix_progress").upsert({
        user_id: user.id,
        content_id: contentId,
        watched: true,
        watched_at: new Date().toISOString(),
        progress_percent: 100,
      }, { onConflict: "user_id,content_id" });
      if (error) throw error;

      setProgress((prev) => {
        const next = new Map(prev);
        next.set(contentId, { content_id: contentId, watched: true, progress_percent: 100 });
        return next;
      });
      toast({ title: "Conteúdo concluído!" });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível salvar progresso.", variant: "destructive" });
    }
  };

  const openWithTutor = (content: EnaflixContent) => {
    navigate("/dashboard/chatgpt", {
      state: {
        initialMessage: `Quero estudar sobre "${content.title}" (${content.specialty}). Me explique este tema em detalhes seguindo o protocolo ENAZIZI.`,
      },
    });
  };

  const openQuestions = (content: EnaflixContent) => {
    navigate("/dashboard/questoes", {
      state: {
        initialTopic: content.specialty,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center py-4">
        <Play className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-2xl font-bold">ENAFLIX</h1>
        <p className="text-muted-foreground">Sua biblioteca de conteúdo médico</p>
      </div>

      {/* Progress bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progresso geral</span>
          <span className="text-sm text-muted-foreground">{totalWatched}/{contents.length} concluídos</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conteúdo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="todos">Todos os tipos</option>
              <option value="video">Vídeos</option>
              <option value="resumo">Resumos</option>
              <option value="aula">Aulas</option>
              <option value="artigo">Artigos</option>
              <option value="podcast">Podcasts</option>
            </select>
          </div>
        )}
      </div>

      {/* Content Grid */}
      {filteredContents.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {contents.length === 0
              ? "Nenhum conteúdo disponível ainda. O professor ou admin pode adicionar conteúdo."
              : "Nenhum resultado para os filtros selecionados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContents.map((content) => {
            const isWatched = progress.get(content.id)?.watched || false;
            const Icon = TYPE_ICONS[content.content_type] || BookOpen;
            const typeColor = TYPE_COLORS[content.content_type] || "bg-gray-500/10 text-gray-500";

            return (
              <Card key={content.id} className={cn("transition-all hover:shadow-md", isWatched && "opacity-75 border-green-500/30")}>
                <CardContent className="p-4 space-y-3">
                  {/* Type badge + watched indicator */}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={cn("text-xs", typeColor)}>
                      <Icon className="h-3 w-3 mr-1" />
                      {content.content_type}
                    </Badge>
                    {isWatched && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>

                  {/* Title + description */}
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2">{content.title}</h3>
                    {content.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{content.description}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{content.specialty}</span>
                    {content.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {content.duration_minutes} min
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {content.video_url && (
                      <Button size="sm" variant="default" className="flex-1 text-xs" asChild>
                        <a href={content.video_url} target="_blank" rel="noopener noreferrer">
                          <Play className="h-3 w-3 mr-1" /> Assistir
                        </a>
                      </Button>
                    )}
                    {!isWatched && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => markAsWatched(content.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => openWithTutor(content)}>
                      <Sparkles className="h-3 w-3 mr-1" /> Tutor IA
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => openQuestions(content)}>
                      <HelpCircle className="h-3 w-3 mr-1" /> Questões
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Enaflix;