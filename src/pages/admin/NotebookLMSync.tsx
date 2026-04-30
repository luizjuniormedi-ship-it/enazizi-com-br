import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  ExternalLink, 
  Music, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search,
  Filter,
  Share2,
  Video,
  BookOpen,
  LayoutDashboard,
  Zap,
  MoreVertical,
  Link,
  RefreshCcw,
  CheckCircle,
  Eye,
  ShieldCheck,
  Award
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const WORKFLOW_STATES = [
  { value: "none", label: "Não Exportado" },
  { value: "exported_to_notebooklm", label: "Exportado" },
  { value: "notebook_created", label: "Notebook Criado" },
  { value: "audio_generated", label: "Áudio Gerado" },
  { value: "notes_generated", label: "Notas Geradas" },
  { value: "reviewed", label: "Revisado Multimídia" },
  { value: "ready_for_students", label: "Pronto p/ Alunos" },
  { value: "published_to_students", label: "Publicado" }
];

export default function NotebookLMSync() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  
  // Link form states
  const [notebookUrl, setNotebookUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [notesUrl, setNotesUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaStatus, setMediaStatus] = useState("notebook_created");

  const { data: contents, isLoading } = useQuery({
    queryKey: ["notebooklm-sync-contents", filterStatus, filterSpecialty, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("master_content_library")
        .select(`
          *,
          notebooklm_notebooks (*)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("media_status", filterStatus);
      }
      if (filterSpecialty !== "all") {
        query = query.eq("discipline", filterSpecialty);
      }
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select("discipline")
        .not("discipline", "is", null);
      if (error) return [];
      return Array.from(new Set(data.map(d => d.discipline)));
    }
  });

  const updateNotebookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data: existing } = await supabase
        .from("notebooklm_notebooks")
        .select("id")
        .eq("content_id", payload.content_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("notebooklm_notebooks")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notebooklm_notebooks")
          .insert([payload]);
        if (error) throw error;
      }

      // Sync status to library
      await supabase
        .from("master_content_library")
        .update({ media_status: payload.media_status })
        .eq("id", payload.content_id);
    },
    onSuccess: () => {
      toast.success("Sincronização NotebookLM atualizada!");
      setIsLinkDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notebooklm-sync-contents"] });
    }
  });

  const handleLinkClick = (content: any) => {
    setSelectedContent(content);
    const notebook = content.notebooklm_notebooks?.[0];
    setNotebookUrl(notebook?.notebook_url || "");
    setAudioUrl(notebook?.audio_url || "");
    setNotesUrl(notebook?.notes_url || "");
    setVideoUrl(notebook?.video_url || "");
    setMediaStatus(content.media_status || "notebook_created");
    setIsLinkDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const state = WORKFLOW_STATES.find(s => s.value === status);
    const label = state ? state.label : status;
    
    switch (status) {
      case "none": return <Badge variant="outline">Não Exportado</Badge>;
      case "exported_to_notebooklm": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Exportado</Badge>;
      case "notebook_created": return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Notebook Criado</Badge>;
      case "audio_generated": return <Badge className="bg-purple-500/10 text-purple-500 border-purple-200">Áudio OK</Badge>;
      case "ready_for_students": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Pronto</Badge>;
      case "published_to_students": return <Badge className="bg-emerald-500 text-white border-emerald-500">Publicado</Badge>;
      default: return <Badge variant="outline">{label}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sincronização NotebookLM</h1>
          <p className="text-muted-foreground">Workflow oficial de publicação multimídia ENAZIZI v1.5.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href='/admin/notebooklm-analytics'}>
            <BarChart3 className="h-4 w-4 mr-2" /> Ver Analytics
          </Button>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["notebooklm-sync-contents"] })}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título ou tema..." 
            className="pl-8" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status Multimídia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {WORKFLOW_STATES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {specialties?.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conteúdo / Especialidade</TableHead>
                <TableHead>Status Workflow</TableHead>
                <TableHead>Ativos Vinculados</TableHead>
                <TableHead>Governança</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
                      <span className="text-sm text-muted-foreground">Carregando conteúdos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                    Nenhum conteúdo encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : contents?.map((item) => {
                const notebook = item.notebooklm_notebooks?.[0];
                const isReady = item.media_status === 'ready_for_students' || item.media_status === 'published_to_students';
                return (
                  <TableRow key={item.id} className={isReady ? "bg-emerald-500/5" : ""}>
                    <TableCell>
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{item.discipline}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.media_status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {notebook?.notebook_url && <Link className="h-4 w-4 text-indigo-500" />}
                        {notebook?.audio_url && <Music className="h-4 w-4 text-purple-500" />}
                        {notebook?.notes_url && <FileText className="h-4 w-4 text-blue-500" />}
                        {notebook?.video_url && <Video className="h-4 w-4 text-orange-500" />}
                        {!notebook && <span className="text-[10px] opacity-40">Sem vínculos</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {item.is_gold_standard && <Award className="h-4 w-4 text-yellow-500" />}
                        {item.hallucination_risk_score < 0.3 ? (
                          <ShieldCheck className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" title="Ver Detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleLinkClick(item)}>
                          <Link className="h-3 w-3 mr-2" /> Vincular
                        </Button>
                        {isReady && item.media_status !== 'published_to_students' && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => updateNotebookMutation.mutate({
                              content_id: item.id,
                              media_status: 'published_to_students'
                            })}
                          >
                            <CheckCircle className="h-3 w-3 mr-2" /> Publicar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Vincular Conteúdo NotebookLM</DialogTitle>
            <DialogDescription>
              Gerencie os links e o status de publicação multimídia.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>URL do Notebook (Google NotebookLM)</Label>
              <Input value={notebookUrl} onChange={e => setNotebookUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>URL do Áudio (Audio Overview)</Label>
              <Input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="URL do arquivo mp3/m4a" />
            </div>
            <div className="space-y-2">
              <Label>URL do Guia de Notas / PDF Complementar</Label>
              <Input value={notesUrl} onChange={e => setNotesUrl(e.target.value)} placeholder="URL do guia interactivo" />
            </div>
            <div className="space-y-2">
              <Label>Status do Workflow Multimídia</Label>
              <Select value={mediaStatus} onValueChange={setMediaStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_STATES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateNotebookMutation.mutate({
              content_id: selectedContent.id,
              notebook_title: selectedContent.title,
              specialty: selectedContent.discipline,
              notebook_url: notebookUrl,
              audio_url: audioUrl,
              notes_url: notesUrl,
              video_url: videoUrl,
              media_status: mediaStatus
            })}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
