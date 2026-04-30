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
  BarChart3
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export default function NotebookLMDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  
  // Link form states
  const [notebookUrl, setNotebookUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [notesUrl, setNotesUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaStatus, setMediaStatus] = useState("notebook_created");

  const { data: contents, isLoading } = useQuery({
    queryKey: ["notebooklm-management-contents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select(`
          *,
          notebooklm_notebooks (*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
      toast.success("Vínculo NotebookLM atualizado!");
      setIsLinkDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notebooklm-management-contents"] });
    }
  });

  const handleLinkClick = (content: any) => {
    setSelectedContent(content);
    const notebook = content.notebooklm_notebooks?.[0];
    setNotebookUrl(notebook?.notebook_url || "");
    setAudioUrl(notebook?.audio_url || "");
    setNotesUrl(notebook?.notes_url || "");
    setVideoUrl(notebook?.video_url || "");
    setMediaStatus(notebook?.media_status || "notebook_created");
    setIsLinkDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "none": return <Badge variant="outline">Sem Mídia</Badge>;
      case "exported_to_notebooklm": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Exportado</Badge>;
      case "notebook_created": return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Notebook Criado</Badge>;
      case "audio_generated": return <Badge className="bg-purple-500/10 text-purple-500 border-purple-200">Áudio OK</Badge>;
      case "ready_for_students": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Pronto para Alunos</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    totalExported: contents?.filter(c => c.media_status !== 'none').length || 0,
    readyForStudents: contents?.filter(c => c.media_status === 'ready_for_students').length || 0,
    pendingAudio: contents?.filter(c => c.media_status === 'notebook_created').length || 0,
    goldMultimedia: contents?.filter(c => c.is_gold_standard && c.media_status === 'ready_for_students').length || 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard NotebookLM</h1>
          <p className="text-muted-foreground">Gestão multimídia de áudio podcasts e guias conversacionais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href='/admin/notebooklm-sync'}>
            <Link className="h-4 w-4 mr-2" /> Sincronização
          </Button>
          <Button variant="outline" onClick={() => window.location.href='/admin/notebooklm-analytics'}>
            <BarChart3 className="h-4 w-4 mr-2" /> Analytics
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Exportado</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExported}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pronto para Alunos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.readyForStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Áudio</CardTitle>
            <Music className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingAudio}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conteúdo Ouro (Multi)</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goldMultimedia}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Gestão de Ativos NotebookLM</CardTitle>
              <CardDescription>Vincule links de áudio e notebooks para publicação pedagógica.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar conteúdo..." 
                  className="pl-8" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conteúdo / Especialidade</TableHead>
                <TableHead>Status Multimídia</TableHead>
                <TableHead>Notebook URL</TableHead>
                <TableHead>Áudio / Guia</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell>
                </TableRow>
              ) : contents?.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => {
                const notebook = item.notebooklm_notebooks?.[0];
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{item.discipline}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.media_status)}</TableCell>
                    <TableCell>
                      {notebook?.notebook_url ? (
                        <a href={notebook.notebook_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" /> Abrir Notebook
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendente</span>
                      )}
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-2">
                        {notebook?.audio_url && <Music className="h-4 w-4 text-purple-500" />}
                        {notebook?.notes_url && <FileText className="h-4 w-4 text-blue-500" />}
                        {notebook?.video_url && <Video className="h-4 w-4 text-indigo-500" />}
                        {!notebook?.audio_url && !notebook?.notes_url && <span className="text-[10px] opacity-40 italic">Sem mídia vinculada</span>}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleLinkClick(item)}>
                        <Link className="h-3 w-3 mr-2" /> Vincular
                      </Button>
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
              Cole os links gerados no NotebookLM Pro para este conteúdo pedagógico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>URL do Notebook (Workspace)</Label>
              <Input value={notebookUrl} onChange={e => setNotebookUrl(e.target.value)} placeholder="https://notebooklm.google.com/notebook/..." />
            </div>
            <div className="space-y-2">
              <Label>URL do Áudio (Audio Overview)</Label>
              <Input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="Link do arquivo de áudio" />
            </div>
            <div className="space-y-2">
              <Label>URL do Guia de Notas (Opcional)</Label>
              <Input value={notesUrl} onChange={e => setNotesUrl(e.target.value)} placeholder="Link para o Guia de Estudo" />
            </div>
            <div className="space-y-2">
              <Label>Status Multimídia</Label>
              <select 
                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={mediaStatus}
                onChange={e => setMediaStatus(e.target.value)}
              >
                <option value="notebook_created">Notebook Criado</option>
                <option value="audio_generated">Áudio Gerado</option>
                <option value="ready_for_students">PRONTO PARA ALUNOS (Publicar)</option>
              </select>
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
            })}>Salvar Vínculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
