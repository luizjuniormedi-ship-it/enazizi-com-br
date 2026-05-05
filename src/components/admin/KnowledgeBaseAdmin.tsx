import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  FileUp, 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  Globe,
  FileText,
  Clock,
  User,
  ShieldCheck,
  Search,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RAGDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'processed' | 'error';
  is_published: boolean;
  error_message: string | null;
  created_at: string;
  organization_id: string;
  uploaded_by: string;
}

export function KnowledgeBaseAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedContent] = useState<RAGDocument | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.organization_id) {
        setDocuments([]);
        return;
      }

      const { data, error } = await supabase
        .from("rag_documents" as any)
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments((data as any) || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar documentos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Tipo de arquivo não suportado", description: "Use PDF, DOCX ou TXT.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).single();
      const orgId = profile?.organization_id || "00000000-0000-0000-0000-000000000000";
      
      const fileExt = file.name.split(".").pop();
      const storagePath = `rag/${orgId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      
      const { error: uploadErr } = await supabase.storage.from("user-uploads").upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data: doc, error: dbErr } = await supabase.from("rag_documents" as any).insert({
        organization_id: orgId,
        uploaded_by: user.id,
        title: file.name,
        file_name: file.name,
        file_path: storagePath,
        file_type: fileExt,
        file_size: file.size,
        status: 'processing'
      }).select().single();

      if (dbErr) throw dbErr;

      toast({ title: "Upload realizado", description: "O processamento iniciou em background." });
      
      // Chamar Edge Function para processar
      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke("process-rag-document", {
        body: { documentId: (doc as any).id, action: "reprocess" }
      });

      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePublish = async (doc: RAGDocument) => {
    try {
      const { error } = await supabase
        .from("rag_documents" as any)
        .update({ is_published: !doc.is_published })
        .eq("id", doc.id);
      if (error) throw error;
      
      toast({ title: doc.is_published ? "Documento ocultado" : "Documento publicado", description: "Disponibilidade para o Tutor atualizada." });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
  };

  const handleReprocess = async (doc: RAGDocument) => {
    try {
      const { error } = await supabase.functions.invoke("process-rag-document", {
        body: { documentId: doc.id, action: "reprocess" }
      });
      if (error) throw error;
      toast({ title: "Reprocessamento iniciado" });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (doc: RAGDocument) => {
    if (!confirm("Tem certeza que deseja excluir este documento? Todos os chunks e embeddings serão removidos.")) return;
    try {
      const { error: dbErr } = await supabase.from("rag_documents" as any).delete().eq("id", doc.id);
      if (dbErr) throw dbErr;
      await supabase.storage.from("user-uploads").remove([(doc as any).file_path]);
      toast({ title: "Documento excluído" });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const filteredDocs = documents.filter(d => 
    d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Base de Conhecimento RAG
          </h2>
          <p className="text-muted-foreground">
            Gerencie os materiais que alimentam a inteligência do seu Tutor Mentor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            className="gap-2 shadow-glow-sm" 
            onClick={() => document.getElementById('rag-upload')?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Enviar Material
          </Button>
          <input 
            id="rag-upload" 
            type="file" 
            className="hidden" 
            accept=".pdf,.docx,.txt" 
            onChange={handleFileUpload} 
          />
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="bg-card/50 backdrop-blur-xl border-white/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Materiais da Organização</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar arquivos..." 
                  className="pl-9 h-9 bg-background/50 border-white/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center">
                <EnaflixLoader label="Carregando biblioteca..." />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Database className="h-8 w-8 text-primary/40" />
                </div>
                <div className="max-w-xs mx-auto">
                  <h3 className="font-bold">Nenhum material encontrado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Envie materiais para o Tutor IA responder com base nas diretrizes da sua instituição.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Visibilidade</TableHead>
                      <TableHead>Upload em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-white/5 border-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate max-w-[200px]">{doc.title}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                                {doc.file_type} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={doc.status} error={doc.error_message} />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={doc.is_published ? "default" : "outline"}
                            className={doc.is_published ? "bg-green-500/20 text-green-500 border-green-500/30" : "text-muted-foreground"}
                          >
                            {doc.is_published ? <Globe className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                            {doc.is_published ? "Publicado" : "Privado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:text-primary" 
                              title="Reprocessar"
                              onClick={() => handleReprocess(doc)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-8 w-8 ${doc.is_published ? "text-green-500" : "text-muted-foreground"}`}
                              title={doc.is_published ? "Despublicar" : "Publicar para Alunos"}
                              onClick={() => handleTogglePublish(doc)}
                            >
                              {doc.is_published ? <ShieldCheck className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(doc)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string, error: string | null }) {
  switch (status) {
    case 'processed':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Processado
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" /> Indexando
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1" title={error || ""}>
          <AlertCircle className="h-3 w-3" /> Falha
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <Clock className="h-3 w-3" /> Pendente
        </Badge>
      );
  }
}

function EnaflixLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm font-bold text-muted-foreground animate-pulse">{label}</p>
    </div>
  );
}
