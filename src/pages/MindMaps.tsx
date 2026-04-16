import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brain, Plus, Search, Loader2, Trash2, Clock, Filter, Sparkles, ArrowLeft, Eye, Network } from "lucide-react";
import { toast } from "sonner";
import { MindMapViewer } from "@/components/mind-maps/MindMapViewer";

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

const DIFFICULTY_LABELS: Record<string, { label: string; class: string }> = {
  easy: { label: "Básico", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medium: { label: "Intermediário", class: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  hard: { label: "Avançado", class: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const COLOR_LEGEND = [
  { color: "bg-blue-500", label: "Definição" },
  { color: "bg-sky-400", label: "Epidemiologia" },
  { color: "bg-purple-500", label: "Fisiopatologia" },
  { color: "bg-yellow-500", label: "Diagnóstico" },
  { color: "bg-green-500", label: "Tratamento" },
  { color: "bg-red-500", label: "Complicações" },
  { color: "bg-gray-400", label: "Prognóstico" },
  { color: "bg-orange-500", label: "Diferenciais" },
  { color: "bg-pink-500", label: "Pontos de Prova" },
];

export default function MindMaps() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "difficulty" | "alpha">("recent");
  const [selectedMap, setSelectedMap] = useState<any>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");

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
      setSelectedMap(data.map);
      toast.success("Mapa mental gerado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mental_maps" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mental-maps"] });
      if (selectedMap) setSelectedMap(null);
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

  const GenerateDialog = () => (
    <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20">
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
            <label className="text-sm font-medium mb-1.5 block">Qual tema você quer estudar? *</label>
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
  );

  // ── MAP VIEWER MODE ──
  if (selectedMap) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] p-3 sm:p-4 md:p-5 animate-fade-in">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-3 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMap(null)} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm sm:text-base font-bold truncate flex-1">{selectedMap.title}</h1>
          <div className="flex items-center gap-2">
            {selectedMap.specialty && <Badge variant="outline" className="text-[10px] hidden sm:flex">{selectedMap.specialty}</Badge>}
            {selectedMap.difficulty && (
              <Badge className={`text-[10px] border ${DIFFICULTY_LABELS[selectedMap.difficulty]?.class || ""}`}>
                {DIFFICULTY_LABELS[selectedMap.difficulty]?.label || selectedMap.difficulty}
              </Badge>
            )}
          </div>
        </div>

        {/* Color legend bar */}
        <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-1 flex-shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Legenda:</span>
          {COLOR_LEGEND.map(c => (
            <div key={c.label} className="flex items-center gap-1 whitespace-nowrap">
              <span className={`h-2.5 w-2.5 rounded-full ${c.color} flex-shrink-0`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Map fills remaining space */}
        <div className="flex-1 min-h-0">
          <MindMapViewer mapData={selectedMap.content_json} />
        </div>
      </div>
    );
  }

  // ── LIST MODE ──
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Mapas Mentais
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize o raciocínio clínico de forma visual e interativa
          </p>
        </div>
        <GenerateDialog />
      </div>

      {/* Filters */}
      {maps.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mapas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Especialidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[140px]">
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : maps.length === 0 ? (
        /* Empty state - first time */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Network className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>

          <h2 className="text-lg font-bold mb-2 text-center">Seus Mapas Mentais</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
            Gere mapas mentais interativos sobre qualquer tema médico.
            A IA organiza o conteúdo seguindo o padrão acadêmico completo.
          </p>

          {/* What you get */}
          <div className="grid grid-cols-3 gap-3 max-w-lg my-6">
            {[
              { icon: "🧠", title: "Estrutura acadêmica", desc: "Definição, diagnóstico, tratamento..." },
              { icon: "🎨", title: "Cores por categoria", desc: "Cada área com sua cor específica" },
              { icon: "🔍", title: "Detalhes ao clicar", desc: "Explicação completa em cada nó" },
            ].map(f => (
              <div key={f.title} className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-2xl">{f.icon}</span>
                <p className="text-[11px] font-semibold mt-1.5">{f.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>

          <GenerateDialog />

          {/* Color legend preview */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {COLOR_LEGEND.map(c => (
              <div key={c.label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${c.color}`} />
                <span className="text-[10px] text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">Nenhum mapa encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou gere um novo mapa.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((map: any) => {
            const nodeCount = map.content_json?.nodes?.length || 0;
            const childCount = map.content_json?.nodes?.reduce((acc: number, n: any) => acc + (n.children?.length || 0), 0) || 0;
            const diffInfo = DIFFICULTY_LABELS[map.difficulty] || DIFFICULTY_LABELS.medium;

            return (
              <Card
                key={map.id}
                className="cursor-pointer hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all group relative overflow-hidden"
                onClick={() => setSelectedMap(map)}
              >
                {/* Color bar at top showing category distribution */}
                <div className="flex h-1">
                  {(map.content_json?.nodes || []).slice(0, 9).map((n: any, i: number) => {
                    const colorClass = {
                      blue: "bg-blue-500", sky: "bg-sky-400", purple: "bg-purple-500",
                      yellow: "bg-yellow-500", green: "bg-green-500", red: "bg-red-500",
                      gray: "bg-gray-400", orange: "bg-orange-500", pink: "bg-pink-500",
                    }[n.color] || "bg-primary";
                    return <div key={i} className={`flex-1 ${colorClass}`} />;
                  })}
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold line-clamp-2 leading-snug">
                        {map.title || map.source_topic}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(map.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {map.specialty && (
                      <Badge variant="outline" className="text-[10px] font-normal">{map.specialty}</Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] border ${diffInfo.class}`}>
                      {diffInfo.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Network className="h-3 w-3" />
                        {nodeCount + childCount} nós
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(map.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
