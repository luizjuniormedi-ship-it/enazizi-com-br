import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brain, Plus, Search, Loader2, Trash2, Clock, Filter, Sparkles } from "lucide-react";
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

  const difficultyColor = (d: string) => {
    if (d === "easy") return "bg-emerald-500/10 text-emerald-500";
    if (d === "hard") return "bg-red-500/10 text-red-500";
    return "bg-amber-500/10 text-amber-500";
  };

  if (selectedMap) {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedMap(null)}>
            ← Voltar
          </Button>
          <h1 className="text-lg font-bold truncate">{selectedMap.title}</h1>
          {selectedMap.specialty && <Badge variant="secondary">{selectedMap.specialty}</Badge>}
        </div>
        <MindMapViewer mapData={selectedMap.content_json} />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Mapas Mentais Inteligentes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize seu raciocínio clínico visualmente
          </p>
        </div>
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Gerar Mapa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Gerar Mapa Mental
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tema *</label>
                <Input
                  placeholder="Ex: Fibrilação Atrial, Pneumonia, ICC..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTopic.trim().length >= 3) {
                      generateMutation.mutate({ topic: newTopic, specialty: newSpecialty, difficulty: newDifficulty });
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Especialidade</label>
                  <Select value={newSpecialty} onValueChange={setNewSpecialty}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                className="w-full gap-2"
                disabled={newTopic.trim().length < 3 || generateMutation.isPending}
                onClick={() => generateMutation.mutate({ topic: newTopic, specialty: newSpecialty, difficulty: newDifficulty })}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando com IA...</>
                ) : (
                  <><Brain className="h-4 w-4" /> Gerar Mapa Mental</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
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

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Nenhum mapa mental encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {maps.length === 0 ? "Comece gerando seu primeiro mapa!" : "Ajuste os filtros ou crie um novo mapa."}
            </p>
            <Button className="mt-4 gap-2" onClick={() => setGenerateOpen(true)}>
              <Plus className="h-4 w-4" /> Gerar Primeiro Mapa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((map: any) => (
            <Card
              key={map.id}
              className="cursor-pointer hover:border-primary/50 transition-all group"
              onClick={() => setSelectedMap(map)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                    {map.title || map.source_topic}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(map.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {map.specialty && (
                    <Badge variant="outline" className="text-[10px]">{map.specialty}</Badge>
                  )}
                  <Badge className={`text-[10px] ${difficultyColor(map.difficulty)}`}>
                    {map.difficulty === "easy" ? "Básico" : map.difficulty === "hard" ? "Avançado" : "Intermediário"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(map.created_at).toLocaleDateString("pt-BR")}
                  <span className="ml-auto">
                    {map.content_json?.nodes?.length || 0} nodes
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
