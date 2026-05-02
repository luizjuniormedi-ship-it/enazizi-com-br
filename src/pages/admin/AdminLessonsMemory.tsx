
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Upload, 
  Video, 
  CheckCircle2, 
  Clock, 
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const AdminLessonsMemory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["admin-tutor-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });


  const uploadVideoMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string, file: File }) => {
      const fileName = `${id}/${crypto.randomUUID()}-${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("tutor-lesson-videos")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("tutor-lesson-videos")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("tutor_lesson_memory")
        .update({ 
          video_url: publicUrl,
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', id);


      if (updateError) throw updateError;
      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Vídeo enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
      setUploadingId(null);
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast.error(`Falha no upload: ${error.message}`);
      setUploadingId(null);
    }
  });

  const handleFileUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Por favor, selecione um arquivo de vídeo válido.");
      return;
    }

    setUploadingId(id);
    uploadVideoMutation.mutate({ id, file });
  };

  const downloadAsPDF = (lesson: any) => {
    // Basic text to file download as a "PDF" placeholder/alternative
    // In a real app we might use jspdf or a backend function
    const content = `
      AULA: ${lesson.title}
      DATA: ${new Date(lesson.created_at).toLocaleString()}
      
      CONTEÚDO PARA NOTEBOOK LM:
      --------------------------
      ${JSON.stringify(lesson.structured_content, null, 2)}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lesson.title.replace(/\s+/g, '_')}_conteudo.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Conteúdo exportado para NotebookLM");
  };

  const filteredLessons = lessons?.filter(lesson => 
    lesson.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lesson.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shadow-inner">
              <Shield className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Memória de Aulas do Tutor</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest opacity-70">Gestão de Conteúdo e Upload de Vídeos</p>
            </div>
          </div>
          
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar aulas..." 
              className="pl-10 bg-slate-50 border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLessons?.map((lesson) => (
              <Card key={lesson.id} className="border-none shadow-sm overflow-hidden hover:shadow-md transition-all group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={lesson.video_url ? "default" : "secondary"} className={cn(
                          "uppercase text-[10px] font-black tracking-widest",
                          lesson.video_url ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500/10 text-amber-600"
                        )}>
                          {lesson.status === 'published' ? "Vídeo Ativo" : lesson.status}
                        </Badge>

                        <span className="text-[10px] text-slate-400 font-mono">#{lesson.id.slice(0, 8)}</span>
                      </div>
                      
                      <h3 className="text-lg font-black text-slate-800 mb-2">{lesson.title || "Sem título"}</h3>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(lesson.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {lesson.subject} / {lesson.topic}

                        </div>
                      </div>
                    </div>

                    <div className="md:w-96 bg-slate-50/50 border-l p-6 flex flex-col justify-center gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          className="text-[10px] font-black uppercase h-10 gap-2 border-slate-200"
                          onClick={() => downloadAsPDF(lesson)}
                        >
                          <Download className="h-3.5 w-3.5" /> NotebookLM
                        </Button>
                        
                        <div className="relative">
                          <input 
                            type="file" 
                            id={`video-upload-${lesson.id}`}
                            className="hidden" 
                            accept="video/*"
                            onChange={(e) => handleFileUpload(lesson.id, e)}
                            disabled={uploadingId === lesson.id}
                          />
                          <Button 
                            asChild
                            variant={lesson.video_url ? "outline" : "default"}
                            className={cn(
                              "w-full text-[10px] font-black uppercase h-10 gap-2",
                              !lesson.video_url && "bg-amber-600 hover:bg-amber-700"
                            )}
                            disabled={uploadingId === lesson.id}
                          >
                            <label htmlFor={`video-upload-${lesson.id}`} className="cursor-pointer">
                              {uploadingId === lesson.id ? (
                                <Clock className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {lesson.video_url ? "Substituir Vídeo" : "Subir Vídeo"}
                            </label>

                          </Button>
                        </div>
                      </div>

                      {lesson.video_url && (
                        <Button 
                          variant="ghost" 
                          className="w-full text-[10px] font-black uppercase h-10 gap-2 text-primary hover:bg-primary/5"
                          onClick={() => window.open(lesson.video_url, '_blank')}
                        >
                          <Video className="h-3.5 w-3.5" /> Assistir Prévia
                        </Button>
                      )}


                      {uploadingId === lesson.id && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-black text-amber-600 uppercase">
                            <span>Enviando...</span>
                            <span>Processando</span>
                          </div>
                          <Progress value={45} className="h-1 bg-amber-100" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredLessons?.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Nenhuma aula encontrada</h3>
                <p className="text-sm text-slate-500">Tente buscar por outro termo ou aguarde novas aulas serem geradas.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLessonsMemory;
