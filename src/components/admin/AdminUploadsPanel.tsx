import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, Database, BookOpen, ImageIcon, RefreshCw, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface UploadRecord {
  id: string;
  filename: string;
  file_type: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  extracted_json: any;
  is_global?: boolean;
  organization_id?: string | null;
  is_published?: boolean;
  is_active?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  starting: "Iniciando...",
  downloading: "Baixando arquivo...",
  extracting_text: "Extraindo texto do PDF...",
  validating: "Validando conteúdo médico...",
  generating_flashcards: "Gerando flashcards com IA...",
  generating_questions: "Gerando questões com IA...",
  populating_questions: "Populando banco de questões...",
  done: "Concluído!",
  error: "Erro no processamento",
};

const AdminUploadsPanel = () => {
  const [files, setFiles] = useState<UploadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchUploads = useCallback(async () => {
    if (!user) return;
    
    // Aluno vê globais. Admin/Prof vê da org dele.
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).single();
    
    let query = supabase
      .from("uploads")
      .select("id, filename, file_type, category, status, created_at, extracted_json, is_global, organization_id, is_published, is_active")
      .order("created_at", { ascending: false });

    if (profile?.organization_id) {
      query = query.or(`is_global.eq.true,organization_id.eq.${profile.organization_id}`);
    } else {
      query = query.eq("is_global", true);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      const typedData = data as unknown as UploadRecord[];
      setFiles(typedData);
      const processing = new Set<string>();
      for (const f of typedData) {
        const json = f.extracted_json as Record<string, any> | null;
        if (f.status === "processing" || (json?.step && json?.step !== "done" && json?.step !== "error")) {
          processing.add(f.id);
        }
      }
      setPollingIds(processing);
    }
  }, [user]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  useEffect(() => {
    if (pollingIds.size === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    pollingRef.current = setInterval(async () => {
      if (!user) return;
      const { data } = await supabase
        .from("uploads")
        .select("id, filename, file_type, category, status, created_at, extracted_json, is_global")
        .in("id", Array.from(pollingIds));
      if (data) {
        setFiles((prev) => {
          const updated = [...prev];
          for (const fresh of data) {
            const idx = updated.findIndex((f) => f.id === fresh.id);
            if (idx >= 0) updated[idx] = fresh;
          }
          return updated;
        });
        const stillProcessing = new Set<string>();
        for (const f of data) {
          const json = f.extracted_json as Record<string, any> | null;
          const step = json?.step;
          if (f.status === "processing" && step !== "done" && step !== "error") {
            stillProcessing.add(f.id);
          } else if (step === "done") {
            toast({ title: "Processamento concluído!", description: `${json?.flashcards_count || 0} flashcards e ${json?.questions_count || 0} questões de ${f.filename}` });
          } else if (step === "error") {
            toast({ title: "Erro no processamento", description: (json?.error as string) || "Erro desconhecido", variant: "destructive" });
          }
        }
        setPollingIds(stillProcessing);
      }
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [pollingIds, user, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 50MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).single();
      const ext = file.name.split(".").pop();
      const storagePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from("user-uploads").upload(storagePath, file);
      if (storageError) throw storageError;

      const { data: uploadRecord, error: dbError } = await supabase
        .from("uploads")
        .insert({ 
          user_id: user.id, 
          filename: file.name, 
          file_type: ext || "unknown", 
          category: "material", 
          storage_path: storagePath, 
          status: "uploaded", 
          is_global: true,
          organization_id: profile?.organization_id 
        })
        .select()
        .single();
      if (dbError) throw dbError;

      toast({ title: "Upload concluído!", description: "Processando em background..." });
      await fetchUploads();

      const { data: session } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ uploadId: uploadRecord.id }),
      }).catch(console.error);

      setPollingIds((prev) => new Set(prev).add(uploadRecord.id));
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (upload: UploadRecord) => {
    const { error } = await supabase.from("uploads").delete().eq("id", upload.id);
    if (!error) {
      setFiles((prev) => prev.filter((f) => f.id !== upload.id));
      toast({ title: "Arquivo removido" });
    }
  };

  const handleReprocess = async (upload: UploadRecord) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ uploadId: upload.id }),
      });
      if (!resp.ok) throw new Error("Falha ao iniciar reprocessamento");
      
      toast({ title: "Reprocessamento iniciado", description: "O arquivo será processado novamente pela IA." });
      setPollingIds((prev) => new Set(prev).add(upload.id));
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro no reprocessamento", description: err.message, variant: "destructive" });
    }
  };

  const handlePopulateQuestions = async (upload: UploadRecord) => {
    try {
      const res = await supabase.functions.invoke("populate-questions", { body: { uploadId: upload.id } });
      if (res.error) throw res.error;
      toast({ title: "Geração iniciada!", description: "Acompanhe o progresso abaixo." });
      setPollingIds((prev) => new Set(prev).add(upload.id));
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro ao popular questões", description: err.message, variant: "destructive" });
    }
  };

  const handleTogglePublish = async (upload: UploadRecord) => {
    try {
      const { error } = await supabase
        .from("uploads")
        .update({ is_published: !upload.is_published } as any)
        .eq("id", upload.id);

      if (error) throw error;
      
      toast({ 
        title: upload.is_published ? "Documento despublicado" : "Documento publicado",
        description: upload.is_published ? "Alunos não verão mais este material." : "Material disponível para o Tutor IA."
      });
      
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar publicação", description: err.message, variant: "destructive" });
    }
  };

  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractingVisual, setExtractingVisual] = useState<string | null>(null);

  const handleExtractVisual = async (upload: UploadRecord) => {
    setExtractingVisual(upload.id);
    try {
      toast({ title: "Extraindo prova com imagens...", description: "O PDF será analisado visualmente pela IA. Pode levar alguns minutos." });
      const res = await supabase.functions.invoke("extract-exam-visual", {
        body: { upload_id: upload.id },
      });
      if (res.error) throw res.error;
      const d = res.data as any;
      toast({
        title: `✅ ${d.total_inserted} questões extraídas!`,
        description: `${d.total_images || 0} com imagens reais. ${d.pages_with_images || 0} páginas com conteúdo visual.`,
      });
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro na extração visual", description: err.message, variant: "destructive" });
    } finally {
      setExtractingVisual(null);
    }
  };

  const handleExtractExam = async (upload: UploadRecord) => {
    setExtracting(upload.id);
    try {
      const res = await supabase.functions.invoke("extract-exam-questions", {
        body: { upload_id: upload.id },
      });
      if (res.error) throw res.error;
      const d = res.data as any;
      toast({
        title: `✅ ${d.total_inserted} questões extraídas!`,
        description: `${d.years_found?.length || 0} anos encontrados. ${d.exam_banks_created?.length || 0} bancas criadas. ${d.total_linked} questões vinculadas.`,
      });
    } catch (err: any) {
      toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(null);
    }
  };

  const handleProcessDocx = async (upload: UploadRecord) => {
    setExtracting(upload.id);
    try {
      toast({ title: "Processando DOCX com imagens...", description: "Isso pode levar alguns minutos." });
      const res = await supabase.functions.invoke("process-docx-questions", {
        body: { uploadId: upload.id, userId: user?.id },
      });
      if (res.error) throw res.error;
      const d = res.data as any;
      toast({
        title: `✅ ${d.total_inserted} questões extraídas!`,
        description: `${d.total_images || 0} com imagens. ${d.pages_processed} páginas processadas.`,
      });
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro no processamento DOCX", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(null);
    }
  };

  const statusIcon = (status: string | null) => {
    switch (status) {
      case "processed": return <CheckCircle className="h-4 w-4 text-success" />;
      case "processing": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "error": return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderProgress = (f: UploadRecord) => {
    const json = f.extracted_json as Record<string, any> | null;
    if (!json || f.status !== "processing") return null;
    const step = (json.step as string) || "";
    const progress = (json.progress as number) || 0;
    const label = STEP_LABELS[step] || step || "Processando...";
    const fc = (json.flashcards_count as number) || 0;
    const qc = (json.questions_count as number) || 0;
    return (
      <div className="w-full mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        {fc > 0 && <span className="text-xs text-muted-foreground">{fc} flashcards{qc > 0 && ` • ${qc} questões`}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Upload className="h-5 w-5 text-primary" />
          Base de Conhecimento
        </h3>
        <p className="text-sm text-muted-foreground">
          Envie materiais para alimentar o Tutor IA e o banco de questões da sua organização.
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={handleFileSelect} />

      <div
        className="glass-card p-6 border-dashed border-2 border-primary/30 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
            <p className="font-medium">Enviando arquivo...</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-primary/50 mx-auto mb-3" />
            <p className="font-medium">Clique para enviar material</p>
            <p className="text-sm text-muted-foreground">PDF, TXT, DOCX — máx 50MB</p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Seus Arquivos ({files.length})</h4>
          <div className="space-y-2">
            {files.map((f) => {
              const isProcessing = f.status === "processing";
              const ejson = f.extracted_json as Record<string, any> | null;
              return (
                <div key={f.id} className="glass-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {statusIcon(f.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.file_type} • {f.status === "processed"
                          ? `✅ ${ejson?.flashcards_count || 0} flashcards${ejson?.questions_count ? ` • ${ejson.questions_count} questões` : ""}`
                          : isProcessing ? "⏳ Processando..." : f.status}
                        {" • "}{new Date(f.created_at).toLocaleDateString("pt-BR")}
                        {f.is_global && <span className="ml-2 text-primary font-bold">[GLOBAL]</span>}
                        {f.is_published ? (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[9px] font-bold uppercase tracking-wider">Publicado</span>
                        ) : (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 text-[9px] font-bold uppercase tracking-wider">Draft</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {f.status === "processed" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("text-muted-foreground transition-colors", f.is_published ? "hover:text-destructive" : "hover:text-success")} 
                          onClick={() => handleTogglePublish(f)}
                          title={f.is_published ? "Despublicar" : "Publicar"}
                        >
                          {f.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                      {f.status !== "processing" && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => handleReprocess(f)} title="Reprocessar com IA">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {f.status === "processed" && (
                        <>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleExtractExam(f)} disabled={extracting === f.id}>
                            {extracting === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                            Extrair
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handlePopulateQuestions(f)}>
                            <Database className="h-3 w-3" /> Gerar Q.
                          </Button>
                        </>
                      )}
                      {!isProcessing && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(f)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {renderProgress(f)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUploadsPanel;
