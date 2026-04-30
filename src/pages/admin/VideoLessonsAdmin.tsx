import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Video, 
  Search, 
  Filter, 
  Clock, 
  BookOpen, 
  MoreVertical, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  ExternalLink,
  History,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";

const VideoLessonsAdmin = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: lessons, isLoading, refetch } = useQuery({
    queryKey: ["admin-video-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_video_lessons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar videoaulas: " + error.message);
        throw error;
      }
      return data;
    }
  });

  const filteredLessons = lessons?.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lesson.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, color: string }> = {
      draft: { label: "Rascunho", color: "bg-gray-500" },
      tutor_lesson_saved: { label: "Aula Salva", color: "bg-blue-500" },
      exported_to_notebooklm: { label: "Exportado", color: "bg-purple-500" },
      video_generated: { label: "Vídeo Gerado", color: "bg-indigo-500" },
      video_review: { label: "Em Revisão", color: "bg-orange-500" },
      approved: { label: "Aprovado", color: "bg-green-500" },
      published: { label: "Publicado", color: "bg-emerald-600" },
      archived: { label: "Arquivado", color: "bg-slate-700" }
    };

    const config = statusMap[status] || { label: status, color: "bg-gray-500" };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("ai_video_lessons")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
    } else {
      toast.success("Status atualizado com sucesso!");
      refetch();
    }
  };

  const stats = {
    total: lessons?.length || 0,
    waitingVideo: lessons?.filter(l => l.status === 'exported_to_notebooklm').length || 0,
    waitingReview: lessons?.filter(l => l.status === 'video_review').length || 0,
    published: lessons?.filter(l => l.status === 'published').length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biblioteca de Videoaulas IA</h1>
          <p className="text-muted-foreground">Gestão e publicação de conteúdos multimídia médicos.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Nova Videoaula
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total de Aulas</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Aguardando Vídeo</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waitingVideo}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Em Revisão</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.waitingReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Publicadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou especialidade..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="exported_to_notebooklm">Aguardando Vídeo</SelectItem>
                  <SelectItem value="video_review">Em Revisão</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Carregando videoaulas...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Videoaula</TableHead>
                  <TableHead>Especialidade / Tema</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma videoaula encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLessons?.map((lesson) => (
                    <TableRow key={lesson.id}>
                      <TableCell>
                        <div className="font-medium">{lesson.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{lesson.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="mb-1">{lesson.specialty}</Badge>
                        <div className="text-sm">{lesson.topic}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(lesson.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(lesson.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <ExternalLink className="h-4 w-4" /> Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <BookOpen className="h-4 w-4" /> Editar Conteúdo
                            </DropdownMenuItem>
                            {lesson.status === 'video_review' && (
                              <DropdownMenuItem 
                                className="gap-2 text-green-600"
                                onClick={() => handleStatusChange(lesson.id, 'approved')}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Aprovar Vídeo
                              </DropdownMenuItem>
                            )}
                            {lesson.status === 'approved' && (
                              <DropdownMenuItem 
                                className="gap-2 text-blue-600"
                                onClick={() => handleStatusChange(lesson.id, 'published')}
                              >
                                <ExternalLink className="h-4 w-4" /> Publicar Aula
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 text-red-600">
                              <AlertCircle className="h-4 w-4" /> Arquivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoLessonsAdmin;