import { Upload as UploadIcon, FileText, Trash2, Loader2, CheckCircle, AlertCircle, HardDrive } from "lucide-react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface UploadItem {
  id: string;
  file: File;
  category: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  speed: string;
  eta: string;
  error?: string;
  storagePath?: string;
}

const CATEGORIES = [
  { value: "material", label: "Material de Estudo" },
  { value: "prova", label: "Prova / Exame" },
  { value: "dataset", label: "Dataset de Imagens" },
];

const ACCEPTED_TYPES = ".pdf,.docx,.zip,.jpg,.jpeg,.png,.webp,.txt";
const MAX_SIZE = 2 * 1024 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatEta(seconds: number) {
  if (!isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getStorageEndpoint() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (projectId) {
    return `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  if (supabaseUrl) {
    const derivedProjectId = new URL(supabaseUrl).hostname.split(".")[0];
    return `https://${derivedProjectId}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  throw new Error("Configuração de upload indisponível.");
}

function normalizeUploadError(error: unknown) {
  if (error instanceof Error) {
    if (/403|401/.test(error.message)) return "Sem permissão para enviar arquivos.";
    if (/404/.test(error.message)) return "Bucket de upload não encontrado.";
    if (/409/.test(error.message)) return "Conflito ao enviar o arquivo. Tente novamente.";
    if (/network/i.test(error.message)) return "Falha de conexão na rede durante o upload.";
    return error.message;
  }

  return "Falha ao enviar arquivo.";
}

const AdminLargeUploadPanel = () => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [category, setCategory] = useState("material");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUploadRef = useRef<tus.Upload | null>(null);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const cancelRequestedRef = useRef(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newItems: UploadItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > MAX_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 2GB.`,
          variant: "destructive",
        });
        continue;
      }

      newItems.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        file,
        category,
        status: "queued",
        progress: 0,
        speed: "",
        eta: "",
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const uploadFile = useCallback(async (item: UploadItem) => {
    if (!user) return;

    const ext = item.file.name.split(".").pop() || "bin";
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const startTime = Date.now();

    updateItem(item.id, {
      status: "uploading",
      progress: 0,
      speed: "Iniciando...",
      eta: "--",
      error: undefined,
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const endpoint = getStorageEndpoint();
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const finishResolve = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const finishReject = (error: Error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };

        const upload = new tus.Upload(item.file, {
          endpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${accessToken}`,
            apikey,
            "x-upsert": "false",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: TUS_CHUNK_SIZE,
          metadata: {
            bucketName: "user-uploads",
            objectName: storagePath,
            contentType: item.file.type || "application/octet-stream",
            cacheControl: "3600",
            metadata: JSON.stringify({
              category: item.category,
              originalName: item.file.name,
              uploadedBy: user.id,
            }),
          },
          onError: (error) => finishReject(new Error(normalizeUploadError(error))),
          onProgress: (bytesUploaded, bytesTotal) => {
            const elapsed = (Date.now() - startTime) / 1000;
            const speedBps = elapsed > 0 ? bytesUploaded / elapsed : 0;
            const remaining = speedBps > 0 ? (bytesTotal - bytesUploaded) / speedBps : 0;
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);

            updateItem(item.id, {
              progress,
              speed: `${formatBytes(speedBps)}/s`,
              eta: formatEta(remaining),
            });
          },
          onSuccess: () => finishResolve(),
        });

        currentUploadRef.current = upload;
        cancelUploadRef.current = () => {
          cancelRequestedRef.current = true;
          void upload.abort(true).finally(() => finishReject(new Error("Upload cancelado")));
        };

        upload
          .findPreviousUploads()
          .then((previousUploads) => {
            if (previousUploads.length > 0) {
              upload.resumeFromPreviousUpload(previousUploads[0]);
            }
            upload.start();
          })
          .catch((error) => finishReject(new Error(normalizeUploadError(error))));
      });

      if (cancelRequestedRef.current) {
        updateItem(item.id, { status: "queued", progress: 0, speed: "", eta: "", error: undefined });
        return;
      }

      updateItem(item.id, { status: "done", progress: 100, speed: "", eta: "", storagePath });

      const { error: dbError } = await supabase.from("uploads").insert({
        user_id: user.id,
        filename: item.file.name,
        file_type: ext,
        category: item.category,
        storage_path: storagePath,
        status: "uploaded",
        is_global: true,
      });

      if (dbError) {
        console.error("DB insert error:", dbError);
      }
    } catch (err) {
      const message = normalizeUploadError(err);

      if (message === "Upload cancelado") {
        updateItem(item.id, { status: "queued", progress: 0, speed: "", eta: "", error: undefined });
      } else {
        updateItem(item.id, {
          status: "error",
          error: message,
          speed: "",
          eta: "",
        });
      }
    } finally {
      currentUploadRef.current = null;
      cancelUploadRef.current = null;
    }
  }, [user, updateItem]);

  const startUpload = useCallback(async () => {
    const queued = items.filter((i) => i.status === "queued");
    if (queued.length === 0) return;

    cancelRequestedRef.current = false;
    setUploading(true);

    for (const item of queued) {
      await uploadFile(item);
      if (cancelRequestedRef.current) break;
    }

    setUploading(false);

    if (cancelRequestedRef.current) {
      toast({ title: "Upload cancelado", description: "O envio foi interrompido." });
      cancelRequestedRef.current = false;
      return;
    }

    toast({ title: "Upload concluído!", description: `${queued.length} arquivo(s) processado(s).` });
  }, [items, uploadFile, toast]);

  const handleCancel = useCallback(() => {
    cancelRequestedRef.current = true;
    cancelUploadRef.current?.();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, [category]);

  const queuedCount = items.filter((i) => i.status === "queued").length;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <HardDrive className="h-5 w-5 text-primary" />
          Upload Grande (até 2GB)
        </h3>
        <p className="text-sm text-muted-foreground">
          Envie arquivos grandes como datasets, coleções de imagens e provas completas.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      <div
        className="glass-card cursor-pointer border-2 border-dashed border-primary/30 p-8 text-center transition-colors hover:border-primary/50"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <UploadIcon className="mx-auto mb-3 h-12 w-12 text-primary/50" />
        <p className="font-medium">Arraste arquivos ou clique para selecionar</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOCX, ZIP, JPG, PNG, WEBP — máx 2GB por arquivo
        </p>
      </div>

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Fila de upload ({items.length} arquivo{items.length > 1 ? "s" : ""})
              {doneCount > 0 && <span className="text-muted-foreground"> • {doneCount} concluído{doneCount > 1 ? "s" : ""}</span>}
            </h4>
            <div className="flex gap-2">
              {uploading && (
                <Button variant="destructive" size="sm" onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
              {queuedCount > 0 && !uploading && (
                <Button size="sm" onClick={startUpload} className="gap-1.5">
                  <UploadIcon className="h-3.5 w-3.5" />
                  Enviar {queuedCount} arquivo{queuedCount > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="glass-card p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {item.status === "done" ? <CheckCircle className="h-4 w-4 text-primary" /> :
                     item.status === "error" ? <AlertCircle className="h-4 w-4 text-destructive" /> :
                     item.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                     <FileText className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.file.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBytes(item.file.size)}</span>
                      <span>•</span>
                      <span>{CATEGORIES.find((c) => c.value === item.category)?.label}</span>
                      {item.speed && <><span>•</span><span>{item.speed}</span></>}
                      {item.eta && item.eta !== "--" && <><span>•</span><span>ETA: {item.eta}</span></>}
                    </div>
                    {item.error && <div className="mt-0.5 text-xs text-destructive">{item.error}</div>}
                  </div>
                  {(item.status === "queued" || item.status === "done" || item.status === "error") && (
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {item.status === "uploading" && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Enviando...</span>
                      <span>{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLargeUploadPanel;
