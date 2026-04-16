import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Brain, Search, Loader2, Trash2, Clock, Filter, Sparkles, Eye, Network,
  FlipVertical, FileText, GraduationCap, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { MapSuggestionsBar } from "@/components/mind-maps/MapSuggestions";

const SPECIALTIES = [
  "Clínica Médica", "Cirurgia Geral", "Pediatria", "Ginecologia e Obstetrícia",
  "Cardiologia", "Pneumologia", "Neurologia", "Ortopedia", "Dermatologia",
  "Endocrinologia", "Nefrologia", "Gastroenterologia", "Infectologia",
];

const DIFFICULTIES = [
  { value: "easy", label: "Básico" },
  { value: "medium", label: "Intermediário" },
  { value: "hard", label: "Avançado" },
];

const DIFFICULTY_COLORS: Record<string, { label: string; dot: string; class: string }> = {
  easy: { label: "Básico", dot: "bg-emerald-500", class: "text-emerald-500" },
  medium: { label: "Intermediário", dot: "bg-amber-500", class: "text-amber-500" },
  hard: { label: "Avançado", dot: "bg-red-500", class: "text-red-500" },
};

const COLOR_BARS: Record<string, string> = {
  blue: "#3b82f6", sky: "#06b6d4", purple: "#8b5cf6",
  yellow: "#eab308", green: "#22c55e", red: "#ef4444",
  gray: "#6b7280", orange: "#f97316", pink: "#ec4899",
};

export default function MindMaps() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "difficulty" | "alpha">("recent");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");

  useEffect(() => {
    const generateTopic = searchParams.get("generate");
    if (generateTopic) {
      setNewTopic(decodeURIComponent(generateTopic));
      setGenerateOpen(true);
    }
  }, [searchParams]);

  const { data: maps = [], isLoading } = useQuery({
    queryKey: ["mental-maps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mental_maps" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!session,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ topic, specialty, difficulty }: { topic: string; specialty: string; difficulty: string }) => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mind-map`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic, specialty, difficulty }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao gerar mapa");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mental-maps"] });
      setGenerateOpen(false);
      setNewTopic("");
      navigate(`/dashboard/mapas-mentais/${data.map.id}`);
      toast.success("Mapa mental gerado com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mental_maps" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mental-maps"] });
      toast.success("Mapa excluído");
    },
  });

  const filtered = maps
    .filter((m: any) => {
      const matchSearch = !search || m.title?.toLowerCase().includes(search.toLowerCase()) || m.source_topic?.toLowerCase().includes(search.toLowerCase());
      const matchSpecialty = filterSpecialty === "all" || m.specialty === filterSpecialty;
      return matchSearch && matchSpecialty;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "alpha") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "difficulty") {
        const order = { easy: 0, medium: 1, hard: 2 };
        return (order[b.difficulty as keyof typeof order] || 0) - (order[a.difficulty as keyof typeof order] || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              Mapas Mentais
            </h1>
            <p className="text-xs text-muted-foreground mt-1 ml-[46px]">
              Organize o raciocínio clínico de forma visual e interativa
            </p>
          </div>

          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20 h-10">
                <Sparkles className="h-4 w-4" />
                Gerar Mapa com IA
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-primary" />
                  Novo Mapa Mental
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Qual tema você quer estudar?</label>
                  <Input
                    placeholder="Ex: Fibrilação Atrial, Pneumonia, ICC..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="h-11"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTopic.trim().length >= 3) {
                        generateMutation.mutate({ topic: newTopic, specialty: newSpecialty, difficulty: newDifficulty });
                      }
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A IA vai gerar um mapa completo com definição, diagnóstico, tratamento e mais.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Especialidade</label>
                    <Select value={newSpecialty} onValueChange={setNewSpecialty}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nível</label>
                    <Select value={newDifficulty} onValueChange={setNewDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full gap-2 h-11"
                  disabled={newTopic.trim().length < 3 || generateMutation.isPending}
                  onClick={() => generateMutation.mutate({ topic: newTopic, specialty: newSpecialty, difficulty: newDifficulty })}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Gerando mapa... (15-30s)</>
                  ) : (
                    <><Brain className="h-4 w-4" /> Gerar Mapa Mental</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        {maps.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar mapas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recente</SelectItem>
                <SelectItem value="alpha">A-Z</SelectItem>
                <SelectItem value="difficulty">Dificuldade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Suggestions */}
        {maps.length > 0 && (
          <MapSuggestionsBar
            onGenerate={(topic, specialty) => {
              setNewTopic(topic);
              if (specialty) setNewSpecialty(specialty);
              setGenerateOpen(true);
            }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl border bg-muted/30 overflow-hidden animate-pulse">
                <div className="h-1.5 bg-muted-foreground/10" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted-foreground/10 rounded w-3/4" />
                  <div className="h-3 bg-muted-foreground/8 rounded w-1/2" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-5 w-16 bg-muted-foreground/8 rounded-full" />
                    <div className="h-5 w-20 bg-muted-foreground/8 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-8">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                <Network className="h-12 w-12 text-primary/60" />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center animate-pulse">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            </div>

            <h2 className="text-lg font-bold mb-2 text-center">Seus Mapas Mentais</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
              Gere mapas mentais interativos com IA sobre qualquer tema médico.
              Organize, revise e transforme conhecimento em material de estudo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mb-8">
              {[
                { icon: <Brain className="h-5 w-5 text-primary" />, title: "Estrutura acadêmica", desc: "Definição, diagnóstico, tratamento e mais" },
                { icon: <FlipVertical className="h-5 w-5 text-emerald-500" />, title: "Gera flashcards", desc: "Um clique para criar material de revisão" },
                { icon: <GraduationCap className="h-5 w-5 text-amber-500" />, title: "Foco em residência", desc: "Conteúdo otimizado para provas" },
              ].map(f => (
                <div key={f.title} className="text-center p-4 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex justify-center mb-2">{f.icon}</div>
                  <p className="text-xs font-semibold">{f.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
                </div>
              ))}
            </div>

            <Button
              className="gap-2 shadow-lg shadow-primary/20 h-11 px-6"
              onClick={() => setGenerateOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Gerar primeiro mapa
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Search className="h-10 w-10 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium">Nenhum mapa encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou gere um novo mapa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((map: any) => {
              const nodeCount = map.content_json?.nodes?.length || 0;
              const childCount = map.content_json?.nodes?.reduce((acc: number, n: any) => acc + (n.children?.length || 0), 0) || 0;
              const diff = DIFFICULTY_COLORS[map.difficulty] || DIFFICULTY_COLORS.medium;
              const mapNodes = map.content_json?.nodes || [];

              return (
                <div
                  key={map.id}
                  className="group relative rounded-2xl border bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/dashboard/mapas-mentais/${map.id}`)}
                >
                  {/* Gradient color bar */}
                  <div className="flex h-1.5">
                    {mapNodes.slice(0, 9).map((n: any, i: number) => (
                      <div
                        key={i}
                        className="flex-1 transition-all duration-300 group-hover:h-2"
                        style={{ background: COLOR_BARS[n.color] || "#3b82f6" }}
                      />
                    ))}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {map.title || map.source_topic}
                        </h3>
                        {map.specialty && (
                          <p className="text-[10px] text-muted-foreground mt-1">{map.specialty}</p>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(map.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir mapa</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Network className="h-3 w-3" />
                        {nodeCount + childCount} nós
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] ${diff.class}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${diff.dot}`} />
                        {diff.label}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(map.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
