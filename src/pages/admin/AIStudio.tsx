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
  Share2
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

export default function AIStudio() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recent");
  const [isGenerating, setIsGenerating] = useState(false);

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
      const { data, error } = await supabase
        .from("ai_generation_queue")
        .select("*, master_content_library(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const stats = {
    total: libraryContent?.length || 0,
    published: libraryContent?.filter(c => c.status === "published").length || 0,
    review: libraryContent?.filter(c => c.status === "review").length || 0,
    processing: queueItems?.filter(q => q.status === "processing").length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Publicado</Badge>;
      case "review": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em Revisão</Badge>;
      case "processing": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">Processando</Badge>;
      case "approved": return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Aprovado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUpload = () => {
    toast.info("Interface de upload será aberta em breve.");
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Central de Produção IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gere, revise e publique conteúdos educacionais de alta fidelidade.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleUpload} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Conteúdo
          </Button>
          <Button variant="outline" className="gap-2">
            <Database className="h-4 w-4" />
            Biblioteca Mestre
          </Button>
        </div>
      </header>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total na Biblioteca</p>
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
                <p className="text-sm font-medium text-muted-foreground">Aguardando Revisão</p>
                <h3 className="text-2xl font-bold text-amber-500">{stats.review}</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Geração Ativa</p>
                <h3 className="text-2xl font-bold text-blue-500">{stats.processing}</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-500" />
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
                      <Button variant="link" onClick={handleUpload}>Clique aqui para começar</Button>
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
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.source_type}</span>
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
                                <DropdownMenuItem>Visualizar</DropdownMenuItem>
                                <DropdownMenuItem>Revisar Conteúdo</DropdownMenuItem>
                                <DropdownMenuItem className="text-primary">Publicar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
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
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um conteúdo mestre" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-indigo-500 hover:bg-indigo-600">Gerar Flashcards (FSRS)</Button>
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
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600">Criar Banco de Questões</Button>
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
                        <Button variant="outline" size="sm">Gerenciar</Button>
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
    </div>
  );
}
