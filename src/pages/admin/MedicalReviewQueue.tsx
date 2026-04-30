import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  BookOpen,
  FlaskConical,
  Award,
  Share2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Database } from "@/integrations/supabase/types";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";


type ContentStatus = Database["public"]["Enums"]["content_status"];

const MedicalReviewQueue = () => {
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: queue, isLoading } = useQuery({
    queryKey: ["medical-review-queue", filterSpecialty, filterStatus, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("master_content_library")
        .select(`
          *,
          pedagogical_reviews (*)
        `)
        .order("created_at", { ascending: false });

      if (filterSpecialty !== "all") {
        query = query.eq("discipline", filterSpecialty);
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus as ContentStatus);
      }
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const exportToNotebookLMMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: content, error: fetchError } = await supabase
        .from("master_content_library")
        .select("*")
        .eq("id", id)
        .single();
      
      if (fetchError) throw fetchError;

      // In a real scenario, this would call an edge function to format the data
      // For now, we update the media status
      const { error: updateError } = await supabase
        .from("master_content_library")
        .update({ 
          media_status: 'exported_to_notebooklm',
          media_added_at: new Date().toISOString()
        })
        .eq("id", id);
      
      if (updateError) throw updateError;
      
      return content;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-review-queue"] });
      toast({ title: "Pacote Exportado", description: "O conteúdo foi formatado para o NotebookLM." });
    }
  });


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ai_generated": return <Badge variant="secondary">IA Gerada</Badge>;
      case "pedagogical_review": return <Badge className="bg-blue-500 text-white">Revisão Pedagógica</Badge>;
      case "scientific_review": return <Badge className="bg-purple-500 text-white">Revisão Científica</Badge>;
      case "approved": return <Badge className="bg-green-500 text-white">Aprovado</Badge>;
      case "published": return <Badge className="bg-emerald-600 text-white">Publicado</Badge>;
      case "rejected": return <Badge variant="destructive">Reprovado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "high": return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Alto</Badge>;
      case "medium": return <Badge className="bg-yellow-500 flex items-center gap-1 text-white"><AlertTriangle className="h-3 w-3" /> Médio</Badge>;
      case "low": return <Badge className="bg-green-500 flex items-center gap-1 text-white">Baixo</Badge>;
      default: return <Badge variant="outline">N/A</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fila de Revisão Médica</h1>
          <p className="text-muted-foreground">Governança pedagógica e científica da produção IA.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["medical-review-queue"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar título..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
          <SelectTrigger>
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Especialidades</SelectItem>
            <SelectItem value="Cardiologia">Cardiologia</SelectItem>
            <SelectItem value="Pediatria">Pediatria</SelectItem>
            <SelectItem value="Ginecologia">Ginecologia</SelectItem>
            <SelectItem value="Cirurgia">Cirurgia</SelectItem>
            <SelectItem value="Infectologia">Infectologia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="ai_generated">Aguardando Revisão</SelectItem>
            <SelectItem value="pedagogical_review">Em Revisão Pedagógica</SelectItem>
            <SelectItem value="scientific_review">Em Revisão Científica</SelectItem>
            <SelectItem value="approved">Pronto para Publicar</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="px-3 py-1">Total: {queue?.length || 0}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título / Especialidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risco Alucinação</TableHead>
                <TableHead>Scores (Ped/Cien)</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Carregando fila...</TableCell>
                </TableRow>
              ) : queue?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum conteúdo encontrado.</TableCell>
                </TableRow>
              ) : queue?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.discipline} • {item.topic}</div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    {getRiskBadge(item.pedagogical_reviews?.[0]?.hallucination_risk || "none")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        P: {item.pedagogical_reviews?.[0]?.didactic_score || "--"}
                      </Badge>
                      <Badge variant="outline" className="text-purple-600 border-purple-200">
                        C: {item.pedagogical_reviews?.[0]?.scientific_accuracy_score || "--"}
                      </Badge>
                      {item.is_gold_standard && (
                        <Award className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {item.status === "ai_generated" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-blue-600"
                          onClick={() => updateStatusMutation.mutate({ id: item.id, status: "pedagogical_review" })}
                        >
                          <BookOpen className="h-4 w-4 mr-1" /> Revisar
                        </Button>
                      )}
                      {item.status === "pedagogical_review" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-purple-600"
                          onClick={() => updateStatusMutation.mutate({ id: item.id, status: "scientific_review" })}
                        >
                          <FlaskConical className="h-4 w-4 mr-1" /> Especialista
                        </Button>
                      )}
                      {item.status === "approved" && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateStatusMutation.mutate({ id: item.id, status: "published" })}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Publicar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalReviewQueue;

