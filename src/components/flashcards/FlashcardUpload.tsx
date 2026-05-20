import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FlashcardUploadProps {
  onSuccess?: () => void;
  userId: string;
}

export const FlashcardUpload = ({ onSuccess, userId }: FlashcardUploadProps) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    setStatus("Fazendo upload do arquivo...");

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(30);
      setStatus("Registrando material...");

      const { data: uploadData, error: dbError } = await supabase
        .from('uploads')
        .insert({
          user_id: userId,
          filename: file.name,
          storage_path: filePath,
          file_type: fileExt,
          file_size: file.size,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setProgress(50);
      setStatus("Iniciando extração e geração de flashcards...");

      // Chama a Edge Function para processar
      const { data, error: functionError } = await supabase.functions.invoke('process-upload', {
        body: { uploadId: uploadData.id, module: 'flashcards' }
      });

      if (functionError) throw functionError;

      setProgress(80);
      setStatus("Processando texto e gerando cards via IA...");

      // Inicia polling opcional ou apenas aguarda o início
      toast({
        title: "Sucesso!",
        description: "O material está sendo processado. Os flashcards aparecerão em instantes.",
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setStatus("");
      setFile(null);
    }
  };

  return (
    <div className="glass-card p-6 border-primary/20 bg-card-pixar/40 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Upload de Material</h3>
          <p className="text-xs text-white/50">PDF, DOCX ou TXT para gerar cards automáticos</p>
        </div>
      </div>

      <div className="grid gap-4">
        <Input 
          type="file" 
          accept=".pdf,.docx,.txt" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="bg-white/5 border-white/10 text-white cursor-pointer"
        />
        
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{status}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <Button 
          onClick={handleUpload} 
          disabled={!file || uploading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-glow-blue"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" /> Gerar Flashcards
            </>
          )}
        </Button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[10px] text-blue-200/60">
        <AlertCircle className="h-3 w-3 mt-0.5" />
        <p>O tempo de geração depende do tamanho do arquivo. Evite arquivos maiores que 10MB para melhor performance.</p>
      </div>
    </div>
  );
};
