import { useState, useCallback, useEffect, useRef } from "react";
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
  Globe,
  FileText,
  Clock,
  ShieldCheck,
  Search,
  BookOpen,
  Info,
  Terminal,
  Layers,
  FileSearch,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  file_path: string;
}

interface ProcessingJob {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  logs: any;
  created_at: string;
}

export function KnowledgeBaseAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<RAGDocument | null>(null);
  const [jobs, setJobs] = useState<Record<string, ProcessingJob>>({});
  const [isLogOpen, setIsLogOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.organization_id) return;

      const { data, error } = await supabase
        .from("rag_documents")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments((data as any[]) || []);

      // Initial check for jobs
      const docIds = (data as any[] || []).map(d => d.id);
      if (docIds.length > 0) {
        const { data: jobsData } = await supabase
          .from("rag_processing_jobs")
          .select("*")
          .in("document_id", docIds)
          .order("created_at", { ascending: false });
        
        if (jobsData) {
          const jobsMap: Record<string, ProcessingJob> = {};
          jobsData.forEach(j => {
            // Only keep the most recent job per document
            if (!jobsMap[j.document_id]) jobsMap[j.document_id] = j;
          });
          setJobs(jobsMap);
        }
      }
    } catch (err: any) {
      console.error("Error fetching docs:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { 
    fetchDocuments(); 
  }, [fetchDocuments]);

  // Polling for processing documents
  useEffect(() => {
    const processingDocs = documents.filter(d => d.status === 'processing' || d.status === 'pending');
    
    if (processingDocs.length === 0) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(() => {
      fetchDocuments();
    }, 5000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [documents, fetchDocuments]);

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

      const { data: doc, error: dbErr } = await supabase.from("rag_documents").insert({
        organization_id: orgId,
        uploaded_by: user.id,
        title: file.name,
        file_name: file.name,
        file_path: storagePath,
        file_type: fileExt || "unknown",
        file_size: file.size,
        status: 'pending'
      }).select().single();

      if (dbErr) throw dbErr;

      toast({ title: "Upload realizado", description: "O processamento iniciou em background." });
      
      // Chamar Edge Function para processar
      await supabase.functions.invoke("process-rag-document", {
        body: { documentId: (doc as any).id, action: "reprocess" }
      });

      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleTogglePublish = async (doc: RAGDocument) => {
    try {
      const { error } = await supabase
        .from("rag_documents")
        .update({ is_published: !doc.is_published })
        .eq("id", doc.id);
      if (error) throw error;
      
      toast({ 
        title: doc.is_published ? "Documento ocultado" : "Documento publicado", 
        description: `O Tutor ${doc.is_published ? 'não consultará mais' : 'passará a consultar'} este material.` 
      });
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
      toast({ title: "Reprocessamento iniciado", description: "O sistema está re-indexando o conteúdo." });
      fetchDocuments();
    } catch (err: any) {
      toast({ title: "Erro ao reprocessar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (doc: RAGDocument) => {
    if (!confirm("Tem certeza que deseja excluir este documento? Todos os chunks e embeddings vinculados serão removidos permanentemente.")) return;
    try {
      const { error: dbErr } = await supabase.from("rag_documents").delete().eq("id", doc.id);
      if (dbErr) throw dbErr;
      await supabase.storage.from("user-uploads").remove([doc.file_path]);
      toast({ title: "Documento excluído com sucesso" });
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
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Base de Conhecimento RAG
          </h2>
          <p className="text-muted-foreground">
            Gerencie os materiais bibliográficos que alimentam as respostas do seu Tutor IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            className="gap-2 shadow-glow-sm bg-primary hover:bg-primary/90" 
            onClick={() => document.getElementById('rag-upload')?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importar Bibliografia
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="bg-card/50 backdrop-blur-xl border-white/5 shadow-xl">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Documentos Registrados</CardTitle>
                  <CardDescription>Materiais indexados por organização</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrar por nome..." 
                    className="pl-9 h-9 bg-background/50 border-white/10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 flex justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando base...</p>
                  </div>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                    <BookOpen className="h-8 w-8 text-primary/40" />
                  </div>
                  <div className="max-w-xs mx-auto">
                    <h3 className="font-bold text-lg">Sem bibliografia</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sua organização ainda não possui materiais RAG. Envie PDFs ou manuais para iniciar.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-primary/30 text-primary"
                      onClick={() => document.getElementById('rag-upload')?.click()}
                    >
                      Primeiro Upload
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="w-[300px]">Documento</TableHead>
                      <TableHead>Status Engine</TableHead>
                      <TableHead>Publicação</TableHead>
                      <TableHead className="text-right">Gerenciamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-white/5 border-white/5 group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate max-w-[200px]" title={doc.title}>{doc.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground uppercase font-mono bg-white/5 px-1 rounded">
                                  {doc.file_type}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                </span>
                                <span className="text-[10px] text-muted-foreground/40">•</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            status={doc.status} 
                            error={doc.error_message} 
                            onClick={() => {
                              setSelectedDoc(doc);
                              setIsLogOpen(true);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "cursor-pointer transition-all duration-300 gap-1.5 px-2.5 py-0.5 border-none",
                              doc.is_published 
                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" 
                                : "bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
                            )}
                            onClick={() => handleTogglePublish(doc)}
                          >
                            <div className={cn("h-1.5 w-1.5 rounded-full", doc.is_published ? "bg-green-500 animate-pulse" : "bg-slate-500")} />
                            {doc.is_published ? "Disponível no Tutor" : "Privado (Admin)"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:text-primary hover:bg-primary/10" 
                              title="Ver Logs e Chunks"
                              onClick={() => {
                                setSelectedDoc(doc);
                                setIsLogOpen(true);
                              }}
                            >
                              <FileSearch className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:text-primary hover:bg-primary/10" 
                              title="Reprocessar"
                              onClick={() => handleReprocess(doc)}
                            >
                              <RefreshCw className="h-4 w-4" />
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
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-xl border-white/5 shadow-xl">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Segurança Multi-Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4 text-muted-foreground">
              <p>
                Os materiais RAG estão isolados por <span className="text-white font-bold">organization_id</span>.
              </p>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  Políticas de RLS ativas para rag_documents, rag_chunks e rag_embeddings.
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  Alunos só acessam materiais marcados como <span className="text-white">Publicado</span>.
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  Embeddings gerados via OpenAI Text-Embedding-3-Small.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-xl border-white/5 shadow-xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Dica Profissional
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground italic">
              "Materiais bem estruturados (com títulos e tópicos claros) geram chunks de melhor qualidade, o que resulta em referências mais precisas para o Tutor IA."
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Log e Status Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Logs de Processamento RAG
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedDoc?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status Atual</span>
                <StatusBadge status={selectedDoc?.status || 'pending'} error={selectedDoc?.error_message} />
              </div>
              <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Última Atividade</span>
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {selectedDoc?.created_at ? new Date(selectedDoc.created_at).toLocaleString('pt-BR') : '---'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Pipeline de Indexação
              </span>
              <ScrollArea className="h-[250px] w-full rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-[11px] leading-relaxed">
                {selectedDoc && jobs[selectedDoc.id] ? (
                  <div className="space-y-1">
                    <p className="text-green-500/70">[{new Date(jobs[selectedDoc.id].created_at).toLocaleTimeString()}] Job criado: {jobs[selectedDoc.id].id}</p>
                    <p className="text-blue-400/70">[{new Date(jobs[selectedDoc.id].started_at || '').toLocaleTimeString()}] Iniciando extração de texto...</p>
                    {jobs[selectedDoc.id].status === 'processed' && (
                      <>
                        <p className="text-blue-400/70">[...] Chunking recursivo finalizado.</p>
                        <p className="text-blue-400/70">[...] Geração de vetores finalizada (OpenAI).</p>
                        <p className="text-green-500">[{new Date(jobs[selectedDoc.id].finished_at || '').toLocaleTimeString()}] Documento pronto para consulta.</p>
                      </>
                    )}
                    {jobs[selectedDoc.id].status === 'error' && (
                      <p className="text-red-500">Error: {jobs[selectedDoc.id].error_message}</p>
                    )}
                    {Array.isArray(jobs[selectedDoc.id].logs) && (jobs[selectedDoc.id].logs as any[]).map((log, i) => (
                      <p key={i} className="text-white/60">{log}</p>
                    ))}
                    {jobs[selectedDoc.id].status === 'queued' && (
                      <p className="text-amber-500 animate-pulse">Aguardando worker de processamento...</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-600 italic">Nenhum log detalhado disponível para este documento.</p>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLogOpen(false)}>Fechar</Button>
            <Button 
              variant="outline" 
              className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => {
                if (selectedDoc) handleReprocess(selectedDoc);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Forçar Re-indexação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, error, onClick }: { status: string, error: string | null, onClick?: () => void }) {
  const getBadge = () => {
    switch (status) {
      case 'processed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Pronto
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexando...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 py-1" title={error || ""}>
            <AlertCircle className="h-3.5 w-3.5" /> Falha
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5 py-1">
            <Clock className="h-3.5 w-3.5" /> Na Fila
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1.5 py-1">
            <Clock className="h-3.5 w-3.5" /> Desconhecido
          </Badge>
        );
    }
  };

  return (
    <div className={cn(onClick && "cursor-pointer hover:opacity-80 transition-opacity")} onClick={onClick}>
      {getBadge()}
    </div>
  );
}
