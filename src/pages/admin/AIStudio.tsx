import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  FileUp, 
  FileText, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  Send,
  History,
  LayoutDashboard,
  Database,
  BarChart3,
  Loader2,
  MoreVertical,
  Filter,
  Zap,
  UserCog,
  Youtube,
  Globe,
  Check,
  X,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Video,
  Music,
  Download,
  Share2,
  TrendingUp,
  RotateCcw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { PedagogicalQualityDashboard } from "@/components/admin/PedagogicalQualityDashboard";

export default function AIStudio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recent");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Form states for new content
  const [newTitle, setNewTitle] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newSourceType, setNewSourceType] = useState("text");
  const [newRawContent, setNewRawContent] = useState("");

  // Queries
  const { data: libraryContent, isLoading: isLoadingLibrary } = useQuery({
    queryKey: ["master-content-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: queueItems, isLoading: isLoadingQueue } = useQuery({
    queryKey: ["ai-generation-queue"],
    queryFn: async () => {
      // Checking for existence of queue table - fallback if not found
      try {
        const { data, error } = await supabase
          .from("ai_generation_queue")
          .select("*, master_content_library(title)")
          .order("created_at", { ascending: false });
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const generateAIContent = useMutation({
    mutationFn: async ({ contentId, isRetry = false }: { contentId: string, isRetry?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-content-ai', {
        body: { contentId, isRetry }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message || "Geração iniciada na fila de processamento.");
      } else {
        toast.info(data?.message || "Processamento em andamento.");
      }
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      queryClient.invalidateQueries({ queryKey: ["ai-generation-queue"] });
    },
    onError: (error) => {
      toast.error("Erro ao iniciar geração: " + error.message);
    }
  });

  const createContent = useMutation({
    mutationFn: async () => {
      const contentHash = btoa(newRawContent.slice(0, 100) + newTitle).slice(0, 32);
      
      // Check for existing content (Reuse/Cache logic)
      const { data: existing } = await supabase
        .from("master_content_library")
        .select("id, title")
        .eq("content_hash", contentHash)
        .single();

      if (existing) {
        toast.info(`Conteúdo reutilizado da Biblioteca Mestre: ${existing.title}`);
        return existing;
      }

      const { data, error } = await supabase
        .from("master_content_library")
        .insert([{
          title: newTitle,
          discipline: newDiscipline,
          topic: newTopic,
          source_type: newSourceType,
          raw_content: newRawContent,
          content_hash: contentHash,
          status: 'processing',
          created_by: user?.id,
          metadata: { version: '1.0.0', audit: 'ready' }
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Conteúdo criado com sucesso!");
      setIsUploadOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      // Trigger AI generation
      generateAIContent.mutate({ contentId: data.id });
    }
  });

  const publishContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("master_content_library")
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo publicado para os alunos!");
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      setIsReviewOpen(false);
    }
  });

  const { data: usageLogs } = useQuery({
    queryKey: ["ai-usage-logs"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("ai_enterprise_usage_logs" as any).select("*");
        if (error) return [];
        return data as any[];
      } catch (e) {
        return [];
      }
    }
  });

  const stats = {
    total: libraryContent?.length || 0,
    published: libraryContent?.filter(c => c.status === "published").length || 0,
    review: libraryContent?.filter(c => c.status === "review").length || 0,
    processing: libraryContent?.filter(c => c.status === "processing").length || 0,
    failed: libraryContent?.filter(c => (c.status as any) === "failed").length || 0,
    savings: usageLogs?.reduce((acc: number, log: any) => acc + (log.reused_from_cache ? 0.50 : 0), 0) || 0,
    cost: usageLogs?.reduce((acc: number, log: any) => acc + Number(log.estimated_cost || 0), 0) || 0
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Publicado</Badge>;
      case "review": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em Revisão</Badge>;
      case "processing": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">Processando</Badge>;
      case "failed": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Falha</Badge>;
      case "approved": return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Aprovado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCopyNotebookLM = (content: any) => {
    const text = `
# EXPORTAÇÃO ENAZIZI -> NOTEBOOKLM
Título: ${content.title}
Disciplina: ${content.discipline}

## RESUMO TÉCNICO
${content.generated_summary || "Pendente"}

## RESUMO FEYNMAN
${content.generated_feynman || "Pendente"}

## ROTEIRO DE VÍDEO / PODCAST
${content.generated_video_script || "Pendente"}

## FLASHCARDS (FSRS)
${JSON.stringify(content.generated_flashcards, null, 2)}

## QUIZ
${JSON.stringify(content.generated_quiz, null, 2)}
    `;
    navigator.clipboard.writeText(text);
    toast.success("Pacote formatado copiado para o NotebookLM Pro!");
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary uppercase">Enterprise</Badge>
            <Badge variant="outline" className="text-[10px] border-indigo-500/20 text-indigo-500 uppercase">NotebookLM Sync</Badge>
            <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20 uppercase font-bold tracking-tighter">v1.0 Production Ready</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-primary/60 bg-clip-text text-transparent">
            Central de Produção IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Geração de conteúdo pedagógico e sincronização com Google NotebookLM Pro.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-glow-sm">
                <Plus className="h-4 w-4" />
                Novo Conteúdo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border-primary/10">
              <DialogHeader>
                <DialogTitle>Produzir Novo Material IA</DialogTitle>
                <DialogDescription>
                  Envie arquivos ou texto para gerar resumos, flashcards e simulados automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Disciplina</Label>
                    <Input placeholder="Ex: Cardiologia" value={newDiscipline} onChange={e => setNewDiscipline(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input placeholder="Ex: Arritmias" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título do Material</Label>
                  <Input placeholder="Título identificador" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Fonte</Label>
                  <Select value={newSourceType} onValueChange={setNewSourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto / Link</SelectItem>
                      <SelectItem value="pdf">Documento PDF</SelectItem>
                      <SelectItem value="youtube">Vídeo YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo Bruto / Link</Label>
                  <Textarea 
                    placeholder="Cole o texto, link do YouTube ou descrição do arquivo..." 
                    className="min-h-[150px] font-mono text-xs"
                    value={newRawContent}
                    onChange={e => setNewRawContent(e.target.value)}
                  />
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-500/80 italic">
                    Ao confirmar, a IA Gemini Flash processará o conteúdo. O sistema verificará automaticamente se este material já existe na Biblioteca Mestre para evitar custos duplicados.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={() => createContent.mutate()} 
                  disabled={createContent.isPending || !newTitle || !newRawContent}
                  className="gap-2"
                >
                  {createContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Iniciar Produção IA
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => setActiveTab("library")} className="gap-2">
            <Database className="h-4 w-4" />
            Biblioteca Mestre
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <h3 className="text-2xl font-bold">{stats.total}</h3>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Publicados</p>
                <h3 className="text-2xl font-bold text-green-500">{stats.published}</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processando</p>
                <h3 className="text-2xl font-bold text-blue-500">{stats.processing}</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Falhas</p>
                <h3 className="text-2xl font-bold text-destructive">{stats.failed}</h3>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-500/5 backdrop-blur-sm border-indigo-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-500/70">Economia IA</p>
                <h3 className="text-xl font-bold text-indigo-500">$ {stats.savings.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 backdrop-blur-sm border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-500/70">Custo Total</p>
                <h3 className="text-xl font-bold text-amber-500">$ {stats.cost.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Studio Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4 border-b border-primary/5 pb-2">
          <TabsList className="bg-transparent gap-2 h-auto p-0">
            <TabsTrigger 
              value="recent" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Recentes
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <Database className="h-4 w-4 mr-2" />
              Biblioteca Completa
            </TabsTrigger>
            <TabsTrigger 
              value="queue" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <History className="h-4 w-4 mr-2" />
              Fila de Geração
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics & Custos
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar conteúdo..." className="pl-9 w-[200px] lg:w-[300px] h-9" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="recent" className="mt-0">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Card className="border-primary/5 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Últimos Conteúdos</CardTitle>
                      <CardDescription>Acompanhe o status dos últimos arquivos processados.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingLibrary ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                  ) : libraryContent?.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Nenhum conteúdo encontrado.</p>
                      <Button variant="link" onClick={() => setIsUploadOpen(true)}>Clique aqui para começar</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {libraryContent?.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-primary/5 hover:border-primary/20 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/5 rounded border border-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.discipline || item.source_type}</span>
                                <span className="text-[10px] text-muted-foreground">•</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {getStatusBadge(item.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedContent(item); setIsReviewOpen(true); }}>
                                  <Eye className="h-4 w-4 mr-2" /> Visualizar / Revisar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generateAIContent.mutate({ contentId: item.id, isRetry: true })}>
                                  <RotateCcw className="h-4 w-4 mr-2" /> Tentar Novamente (Retry)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyNotebookLM(item)}>
                                  <Copy className="h-4 w-4 mr-2" /> Exportar NotebookLM
                                </DropdownMenuItem>
                                {item.status === 'review' && (
                                  <DropdownMenuItem className="text-primary" onClick={() => publishContent.mutate(item.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Publicar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                      <Button variant="ghost" className="w-full text-xs text-muted-foreground mt-2" onClick={() => setActiveTab("library")}>
                        Ver todos os conteúdos
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick AI Toolbox */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-primary/5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      Gerar Novos Flashcards
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select onValueChange={(val) => generateAIContent.mutate({ contentId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um conteúdo mestre" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-indigo-500 hover:bg-indigo-600" disabled={generateAIContent.isPending}>
                      {generateAIContent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Gerar Flashcards (FSRS)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-primary/5 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-emerald-500" />
                      Extrair Questões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select onValueChange={(val) => generateAIContent.mutate({ contentId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600" disabled={generateAIContent.isPending}>
                       {generateAIContent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                       Criar Banco de Questões
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sidebar with Generation Queue */}
            <Card className="border-primary/5 bg-card/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Fila Ativa</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{stats.processing} tarefas</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingQueue ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                  </div>
                ) : queueItems?.filter(q => q.status !== "completed").length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-primary/5 rounded-xl border border-primary/10">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Nenhuma tarefa em execução.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queueItems?.filter(q => q.status !== "completed").slice(0, 4).map((task) => (
                      <div key={task.id} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate max-w-[150px]">{task.master_content_library?.title}</span>
                          <span className="text-primary animate-pulse">{task.status === 'processing' ? 'Processando' : 'Na fila'}</span>
                        </div>
                        <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary animate-shimmer" 
                            style={{ width: task.status === 'processing' ? '65%' : '10%' }} 
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-widest">
                          <Zap className="h-2 w-2" />
                          {task.task_type.replace('_', ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-8 pt-6 border-t border-primary/5 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Info Pedagógica</h4>
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Todo conteúdo IA deve ser revisado antes da publicação. Alunos verão a tag "Revisado pela Equipe Pedagógica".
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="library">
           {/* Comprehensive list of content with advanced filtering */}
           <Card className="border-primary/5">
              <CardContent className="p-0">
                <div className="divide-y divide-primary/5">
                  {libraryContent?.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> Admin: {item.created_by?.slice(0, 8)}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block mr-4">
                          <p className="text-xs font-medium">Custo Estimado</p>
                          <p className="text-xs text-muted-foreground">$ {item.estimated_cost?.toFixed(2) || "0.00"}</p>
                        </div>
                        {getStatusBadge(item.status)}
                        <Button variant="outline" size="sm" onClick={() => { setSelectedContent(item); setIsReviewOpen(true); }}>Gerenciar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
             <Card className="border-primary/5">
               <CardHeader>
                 <CardTitle className="text-base">Distribuição de Conteúdo</CardTitle>
               </CardHeader>
               <CardContent className="h-[300px] flex items-center justify-center border-t border-primary/5">
                 <p className="text-muted-foreground text-sm">Gráfico de distribuição por tipo será renderizado aqui.</p>
               </CardContent>
             </Card>
             <Card className="border-primary/5">
               <CardHeader>
                 <CardTitle className="text-base">Evolução de Custos (30 dias)</CardTitle>
               </CardHeader>
               <CardContent className="h-[300px] flex items-center justify-center border-t border-primary/5">
                 <p className="text-muted-foreground text-sm">Gráfico de evolução financeira será renderizado aqui.</p>
               </CardContent>
             </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Content Review & NotebookLM Export Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 bg-card">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">{selectedContent?.title}</DialogTitle>
                <DialogDescription>{selectedContent?.discipline} • {selectedContent?.topic}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedContent && getStatusBadge(selectedContent.status)}
                <Button variant="outline" size="sm" onClick={() => handleCopyNotebookLM(selectedContent)}>
                  <Copy className="h-4 w-4 mr-2" /> NotebookLM
                </Button>
                {selectedContent?.status !== 'published' && (
                  <Button size="sm" onClick={() => publishContent.mutate(selectedContent.id)}>
                    Publicar Agora
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <TabsList className="px-6 bg-transparent border-b rounded-none h-12 gap-4">
                <TabsTrigger value="overview">Resumo Técnico</TabsTrigger>
                <TabsTrigger value="feynman">Feynman</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                <TabsTrigger value="quiz">Quiz / Questões</TabsTrigger>
                <TabsTrigger value="notebooklm" className="text-indigo-500">Google NotebookLM</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-6">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {selectedContent?.generated_summary || "O conteúdo ainda está sendo processado pela IA..."}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="feynman" className="mt-0">
                  <div className="p-6 rounded-xl bg-primary/5 border border-primary/10">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" /> Técnica Feynman (Simplicidade)
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedContent?.generated_feynman || "Geração em andamento..."}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="flashcards" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedContent?.generated_flashcards?.map((card: any, idx: number) => (
                      <Card key={idx} className="bg-background/50">
                        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 border-b border-primary/5">
                          <Badge variant="outline" className="text-[10px]">Flashcard {idx + 1}</Badge>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Check className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-3 w-3" /></Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <p className="text-sm font-bold">{card.front || card.pergunta}</p>
                          <Separator className="bg-primary/5" />
                          <p className="text-sm text-muted-foreground italic">{card.back || card.resposta}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="notebooklm" className="mt-0 space-y-6">
                  <div className="p-6 rounded-xl border-2 border-dashed border-indigo-500/20 bg-indigo-500/5 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                        <Music className="h-5 w-5 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-indigo-500">Integração NotebookLM Pro</h4>
                        <p className="text-xs text-muted-foreground">
                          Siga o fluxo abaixo para gerar Deep Dive Audio (Podcasts) e Overview Videos.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-bold">1</span>
                          <p className="text-xs font-medium">Exportar pacote ENAZIZI</p>
                        </div>
                        <Button 
                          className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                          onClick={() => handleCopyNotebookLM(selectedContent)}
                        >
                          <Copy className="h-4 w-4" /> Copiar Pacote para NotebookLM
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-bold">2</span>
                          <p className="text-xs font-medium">Vincular links gerados</p>
                        </div>
                        <div className="space-y-2">
                          <Input placeholder="Link do Deep Dive Audio" className="h-8 text-[11px]" />
                          <Input placeholder="Link do Guia de Estudo" className="h-8 text-[11px]" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-indigo-500/10 flex justify-between items-center">
                       <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                         <ExternalLink className="h-3 w-3" /> Requer assinatura NotebookLM Pro / Enterprise
                       </p>
                       <Button variant="link" className="text-indigo-500 text-xs h-auto p-0">Ver tutorial de integração</Button>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-primary/10 flex items-center justify-between">
                       <p className="text-[10px] text-muted-foreground italic uppercase tracking-widest">ENAZIZI - Central de Produção IA</p>
                       <p className="text-[10px] text-muted-foreground">Certified v1.0</p>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
