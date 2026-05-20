import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, Database } from "lucide-react";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface UploadRecord {
  id: string;
  filename: string;
  file_type: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  extracted_json: any;
  is_global?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  starting: "Iniciando...",
  downloading: "Baixando arquivo...",
  extracting_text: "Extraindo texto e processando OCR...",
  extracting_topics: "Identificando temas médicos...",
  consolidating: "Consolidando dados...",
  validating: "Validando conteúdo médico...",
  generating_flashcards: "Gerando flashcards com IA...",
  generating_questions: "Gerando questões com IA...",
  populating_questions: "Populando banco de questões...",
  done: "Concluído!",
  error: "Erro no processamento",
};

const Uploads = () => {
  const [files, setFiles] = useState<UploadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = useAdminCheck();

  const fetchUploads = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("uploads")
      .select("id, filename, file_type, category, status, created_at, extracted_json, is_global")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setFiles(data);
      // Detect which uploads are still processing
      const processing = new Set<string>();
      for (const f of data) {
        const json = f.extracted_json as Record<string, any> | null;
        if (f.status === "processing" || (json?.step === "populating_questions" && json?.step !== "done")) {
          processing.add(f.id);
        }
      }
      setPollingIds(processing);
    }
  }, [user]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // Polling for in-progress uploads
  useEffect(() => {
    if (pollingIds.size === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Poll every 3 seconds
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

        // Check if any finished
        const stillProcessing = new Set<string>();
        for (const f of data) {
          const json = f.extracted_json as Record<string, any> | null;
          const step = json?.step;
          if (f.status === "processing" && step !== "done" && step !== "error") {
            stillProcessing.add(f.id);
          } else if (step === "done") {
            const qc = json?.questions_count || 0;
            const fc = json?.flashcards_count || 0;
            toast({ title: "Processamento concluído!", description: `${fc} flashcards e ${qc} questões geradas de ${f.filename}` });
          } else if (step === "error") {
            toast({ title: "Erro no processamento", description: (json?.error as string) || "Erro desconhecido", variant: "destructive" });
          }
        }
        setPollingIds(stillProcessing);
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingIds, user, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 20MB para processamento estável.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("user-uploads")
        .upload(storagePath, file);

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
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast({ title: "Upload concluído!", description: "Processando em background com IA..." });
      await fetchUploads();

      // Trigger background processing
      const { data: session } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ uploadId: uploadRecord.id }),
      }).catch(console.error); // Fire and forget — we'll poll

      // Start polling for this upload
      setPollingIds((prev) => new Set(prev).add(uploadRecord.id));
      await fetchUploads();

    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (upload: UploadRecord) => {
    if (!confirm("Tem certeza que deseja excluir este arquivo e todos os dados extraídos dele?")) return;
    const { error } = await supabase.from("uploads").delete().eq("id", upload.id);
    if (!error) {
      setFiles((prev) => prev.filter((f) => f.id !== upload.id));
      toast({ title: "Arquivo removido" });
    }
  };

  const handlePopulateQuestions = async (upload: UploadRecord) => {
    try {
      const res = await supabase.functions.invoke("populate-questions", {
        body: { uploadId: upload.id },
      });
      if (res.error) throw res.error;
      toast({ title: "Geração iniciada!", description: "Acompanhe o progresso abaixo." });
      // Start polling
      setPollingIds((prev) => new Set(prev).add(upload.id));
      fetchUploads();
    } catch (err: any) {
      toast({ title: "Erro ao popular questões", description: err.message, variant: "destructive" });
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
        {fc > 0 && (
          <span className="text-xs text-muted-foreground">
            {fc} flashcards
            {qc > 0 && ` • ${qc} questões`}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            Uploads
          </h1>
          <p className="text-muted-foreground">Envie materiais de medicina para gerar flashcards e questões automaticamente com IA.</p>
        </div>
        <ModuleHelpButton moduleKey="uploads" moduleName="Uploads" steps={[
          "Clique na área de upload ou arraste um arquivo PDF, TXT, DOCX ou Imagem (JPG/PNG)",
          "A IA extrai o conteúdo e identifica temas médicos automaticamente",
          "Aguarde o processamento — acompanhe pela barra de progresso",
          "Após processar, gere flashcards e questões a partir do material",
          "Os materiais ficam salvos e acessíveis para consulta futura",
          "Use a categoria para organizar seus uploads por especialidade",
        ]} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div
        className="glass-card p-8 border-dashed border-2 border-primary/30 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-lg font-medium mb-1">Enviando arquivo...</p>
            <p className="text-sm text-muted-foreground">O processamento acontecerá em background</p>
          </>
        ) : (
          <>
            <Upload className="h-12 w-12 text-primary/50 mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">Clique para enviar arquivo</p>
            <p className="text-sm text-muted-foreground">PDF, TXT, DOCX, Imagens — máx 20MB</p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Arquivos enviados</h2>
          <div className="space-y-3">
            {files.map((f) => {
              const isProcessing = f.status === "processing";
              const ejson = f.extracted_json as Record<string, any> | null;
              const isPopulating = ejson?.step === "populating_questions" && ejson?.step !== "done";

              return (
                <div key={f.id} className="glass-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {statusIcon(f.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.file_type} • {f.status === "processed"
                          ? `✅ ${ejson?.total_topics || 0} temas identificados`
                          : isProcessing ? `⏳ ${(ejson?.progress || 0)}% - ${STEP_LABELS[ejson?.step || 'starting']}` : f.status}
                        {" • "}{new Date(f.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    {isAdmin && f.status === "processed" && !isPopulating && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handlePopulateQuestions(f)}
                      >
                        <Database className="h-3 w-3" />
                        Gerar Questões
                      </Button>
                    )}
                    {!isProcessing && (
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

export default Uploads;
