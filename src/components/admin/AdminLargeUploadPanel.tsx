import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, HardDrive } from "lucide-react";
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
const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

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

function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Falha na conexão de rede"));
    xhr.ontimeout = () => reject(new Error("Timeout no upload"));

    if (signal) {
      signal.addEventListener("abort", () => { xhr.abort(); reject(new Error("Upload cancelado")); });
    }

    const formData = new FormData();
    formData.append("", file, file.name);
    xhr.send(formData);
  });
}

const AdminLargeUploadPanel = () => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [category, setCategory] = useState("material");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newItems: UploadItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > MAX_SIZE) {
        toast({ title: "Arquivo muito grande", description: `${file.name} excede 2GB.`, variant: "destructive" });
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
    setItems(prev => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const uploadFile = useCallback(async (item: UploadItem) => {
    if (!user) return;
    const ext = item.file.name.split(".").pop() || "bin";
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    updateItem(item.id, { status: "uploading", progress: 0, speed: "Iniciando...", eta: "--" });

    const startTime = Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/user-uploads/${storagePath}`;

      const contentType = item.file.type || "application/octet-stream";

      await uploadWithProgress(
        uploadUrl,
        item.file,
        {
          Authorization: `Bearer ${accessToken}`,
          apikey: apiKey,
          "x-upsert": "false",
          "Content-Type": contentType,
        },
        (loaded, total) => {
          const elapsed = (Date.now() - startTime) / 1000;
          const speedBps = elapsed > 0 ? loaded / elapsed : 0;
          const remaining = speedBps > 0 ? (total - loaded) / speedBps : 0;
          const progress = Math.round((loaded / total) * 100);
          updateItem(item.id, {
            progress,
            speed: `${formatBytes(speedBps)}/s`,
            eta: formatEta(remaining),
          });
        },
        controller.signal,
      );

      updateItem(item.id, { status: "done", progress: 100, speed: "", eta: "", storagePath });

      // Insert DB record
      const { error: dbError } = await supabase.from("uploads").insert({
        user_id: user.id,
        filename: item.file.name,
        file_type: ext,
        category: item.category,
        storage_path: storagePath,
        status: "uploaded",
        is_global: true,
      });
      if (dbError) console.error("DB insert error:", dbError);

    } catch (err: any) {
      if (err.message === "Upload cancelado") {
        updateItem(item.id, { status: "queued", progress: 0, speed: "", eta: "", error: undefined });
      } else {
        updateItem(item.id, {
          status: "error",
          error: err.message || "Erro desconhecido",
          speed: "",
          eta: "",
        });
      }
    }
  }, [user, updateItem]);

  const startUpload = useCallback(async () => {
    const queued = items.filter(i => i.status === "queued");
    if (queued.length === 0) return;
    setUploading(true);

    for (const item of queued) {
      await uploadFile(item);
    }

    setUploading(false);
    toast({ title: "Upload concluído!", description: `${queued.length} arquivo(s) processado(s).` });
  }, [items, uploadFile, toast]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, [category]);

  const queuedCount = items.filter(i => i.status === "queued").length;
  const doneCount = items.filter(i => i.status === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
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
            {CATEGORIES.map(c => (
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
        onChange={(e) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
      />

      <div
        className="glass-card p-8 border-dashed border-2 border-primary/30 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <Upload className="h-12 w-12 text-primary/50 mx-auto mb-3" />
        <p className="font-medium">Arraste arquivos ou clique para selecionar</p>
        <p className="text-sm text-muted-foreground mt-1">
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
                  <Upload className="h-3.5 w-3.5" />
                  Enviar {queuedCount} arquivo{queuedCount > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="glass-card p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {item.status === "done" ? <CheckCircle className="h-4 w-4 text-primary" /> :
                     item.status === "error" ? <AlertCircle className="h-4 w-4 text-destructive" /> :
                     item.status === "uploading" ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> :
                     <FileText className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.file.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{formatBytes(item.file.size)}</span>
                      <span>•</span>
                      <span>{CATEGORIES.find(c => c.value === item.category)?.label}</span>
                      {item.speed && <><span>•</span><span>{item.speed}</span></>}
                      {item.eta && item.eta !== "--" && <><span>•</span><span>ETA: {item.eta}</span></>}
                    </div>
                    {item.error && <div className="text-xs text-destructive mt-0.5">{item.error}</div>}
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
