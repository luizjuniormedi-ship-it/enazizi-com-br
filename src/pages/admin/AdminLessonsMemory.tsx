import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Upload,
  Video,
  Clock,
  Search,
  Shield,
  Download,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
];

const STATUS_LABEL: Record<string, string> = {
  structuring: "Estruturando",
  pending_review: "Estruturada",
  in_production: "Em produção",
  needs_adjustment: "Precisa ajuste",
  ready_to_publish: "Pronto para publicar",
  published: "Publicado",
  unpublished: "Despublicado",
  archived: "Arquivado",
  rejected: "Rejeitado",
};

const STATUS_COLOR: Record<string, string> = {
  structuring: "bg-blue-500/10 text-blue-700 animate-pulse",
  pending_review: "bg-slate-500/10 text-slate-700",
  in_production: "bg-blue-500/10 text-blue-700",
  needs_adjustment: "bg-orange-500/10 text-orange-700",
  ready_to_publish: "bg-amber-500/10 text-amber-700",
  published: "bg-emerald-500 text-white hover:bg-emerald-600",
  unpublished: "bg-slate-300 text-slate-700",
  archived: "bg-slate-200 text-slate-500",
  rejected: "bg-red-500/10 text-red-700",
};

const MIN_CHECKLIST = [
  ["title_reviewed", "Título revisado"],
  ["content_reviewed", "Conteúdo revisado"],
  ["video_attached", "Vídeo anexado"],
  ["no_hallucination", "Sem alucinação"],
  ["ready_to_publish", "Pronto para publicar"],
] as const;

const AdminLessonsMemory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["admin-tutor-lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_lesson_memory")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logEvent = async (
    lessonId: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tutor_lesson_events").insert([
      {
        lesson_id: lessonId,
        actor_id: user.id,
        event_type: eventType,
        metadata,
      },
    ] as any);
  };

  const uploadVideoMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fileName = `${id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("tutor-lesson-videos")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("tutor_lesson_memory")
        .update({
          // armazenamos apenas o path; signed URL é gerado on-demand
          video_url: fileName,
          status: "ready_to_publish",
        })
        .eq("id", id);
      if (updateError) throw updateError;

      await logEvent(id, "lesson_uploaded", { path: fileName, size: file.size });
      await logEvent(id, "lesson_ready_to_publish", {});
      return fileName;
    },
    onSuccess: () => {
      toast.success("Upload concluído. Aula pronta para publicar.");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
      setUploadingId(null);
    },
    onError: (error: any) => {
      toast.error(`Falha no upload: ${error.message}`);
      setUploadingId(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (lesson: any) => {
      // Validações antes de publicar
      if (!lesson.video_url) throw new Error("Sem vídeo enviado");
      if (!lesson.title?.trim()) throw new Error("Título obrigatório");
      if (!lesson.subject?.trim() && !lesson.topic?.trim()) {
        throw new Error("Informe disciplina ou tema");
      }
      if (lesson.status !== "ready_to_publish") {
        throw new Error(`Status inválido para publicar: ${lesson.status}`);
      }

      const { error } = await supabase
        .from("tutor_lesson_memory")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", lesson.id);
      if (error) throw error;
      await logEvent(lesson.id, "lesson_published", {});
    },
    onSuccess: () => {
      toast.success("Aula publicada para os alunos.");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
      setPublishingId(null);
    },
    onError: (e: any) => {
      toast.error(`Não foi possível publicar: ${e.message}`);
      setPublishingId(null);
    },
  });

  const handleFileUpload = (
    id: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Formato inválido. Use MP4, WebM, MOV, MKV ou AVI.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Arquivo maior que 500 MB.");
      return;
    }
    setUploadingId(id);
    uploadVideoMutation.mutate({ id, file });
  };

  const handlePreview = async (lesson: any) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "tutor-lesson-signed-url",
        { body: { lesson_id: lesson.id } },
      );
      if (error || !data?.signed_url) throw error || new Error("sem url");
      window.open(data.signed_url, "_blank");
    } catch (e: any) {
      toast.error(`Falha ao gerar preview: ${e.message ?? "erro"}`);
    }
  };

  const exportLesson = async (
    lesson: any,
    format: "notebooklm" | "gemini" | "google_vids" | "markdown" | "txt",
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "tutor-lesson-export",
        { body: { lesson_id: lesson.id, format } },
      );
      if (error || !data?.content) throw error || new Error("Sem conteúdo");
      const blob = new Blob([data.content], { type: data.mime || "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exportação ${format} concluída`);
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e.message ?? "erro"}`);
    }
  };

  const restructureLesson = async (lesson: any) => {
    try {
      toast.info("Reestruturando aula com IA...");
      const { error } = await supabase.functions.invoke(
        "tutor-lesson-structure",
        { body: { lesson_id: lesson.id } },
      );
      if (error) throw error;
      toast.success("Aula reestruturada");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
    } catch (e: any) {
      toast.error(`Falha ao reestruturar: ${e.message ?? "erro"}`);
    }
  };

  const toggleChecklistItem = async (lesson: any, key: string) => {
    const next = { ...(lesson.quality_checklist || {}), [key]: !lesson.quality_checklist?.[key] };
    const { error } = await supabase
      .from("tutor_lesson_memory")
      .update({ quality_checklist: next })
      .eq("id", lesson.id);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
    }
  };

  const downloadAsPDF = (lesson: any) => {
    const content =
      `AULA: ${lesson.title}\n` +
      `DATA: ${new Date(lesson.created_at).toLocaleString()}\n\n` +
      `CONTEÚDO PARA NOTEBOOK LM:\n--------------------------\n` +
      JSON.stringify(lesson.structured_content, null, 2);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lesson.title?.replace(/\s+/g, "_") || "aula"}_conteudo.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Conteúdo exportado para NotebookLM");
  };

  const filteredLessons = lessons?.filter(
    (lesson) =>
      lesson.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.status?.toLowerCase().includes(searchTerm.toLowerCase()),
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
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Memória de Aulas do Tutor
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest opacity-70">
                Curadoria · Upload · Publicação manual
              </p>
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
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-48 bg-slate-200 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLessons?.map((lesson) => {
              const hasVideo = !!lesson.video_url;
              const canPublish = lesson.status === "ready_to_publish";
              const isPublished = lesson.status === "published";
              return (
                <Card
                  key={lesson.id}
                  className="border-none shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="flex-1 p-6">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            className={cn(
                              "uppercase text-[10px] font-black tracking-widest",
                              STATUS_COLOR[lesson.status] ??
                                "bg-slate-200 text-slate-700",
                            )}
                          >
                            {STATUS_LABEL[lesson.status] ?? lesson.status}
                          </Badge>
                          {hasVideo && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Video className="h-3 w-3" /> Vídeo anexado
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{lesson.id.slice(0, 8)}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-slate-800 mb-2">
                          {lesson.title || "Sem título"}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(lesson.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {lesson.subject || "—"} / {lesson.topic || "—"}
                          </div>
                        </div>
                      </div>

                      <div className="md:w-[420px] bg-slate-50/50 border-l p-6 flex flex-col justify-center gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="text-[10px] font-black uppercase h-10 gap-2 border-slate-200"
                            onClick={() => exportLesson(lesson, "notebooklm")}
                            disabled={!lesson.structured_content?.title}
                          >
                            <Download className="h-3.5 w-3.5" /> NotebookLM
                          </Button>

                          <div className="relative">
                            <input
                              type="file"
                              id={`video-upload-${lesson.id}`}
                              className="hidden"
                              accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
                              onChange={(e) => handleFileUpload(lesson.id, e)}
                              disabled={uploadingId === lesson.id}
                            />
                            <Button
                              asChild
                              variant={hasVideo ? "outline" : "default"}
                              className={cn(
                                "w-full text-[10px] font-black uppercase h-10 gap-2",
                                !hasVideo && "bg-amber-600 hover:bg-amber-700",
                              )}
                              disabled={uploadingId === lesson.id}
                            >
                              <label
                                htmlFor={`video-upload-${lesson.id}`}
                                className="cursor-pointer"
                              >
                                {uploadingId === lesson.id ? (
                                  <Clock className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                {hasVideo ? "Substituir vídeo" : "Subir vídeo"}
                              </label>
                            </Button>
                          </div>
                        </div>

                        {hasVideo && (
                          <Button
                            variant="ghost"
                            className="w-full text-[10px] font-black uppercase h-10 gap-2 text-primary hover:bg-primary/5"
                            onClick={() => handlePreview(lesson)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> Preview seguro
                          </Button>
                        )}

                        {canPublish && (
                          <Button
                            className="w-full text-[10px] font-black uppercase h-10 gap-2 bg-emerald-600 hover:bg-emerald-700"
                            disabled={publishingId === lesson.id}
                            onClick={() => {
                              setPublishingId(lesson.id);
                              publishMutation.mutate(lesson);
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {publishingId === lesson.id
                              ? "Publicando..."
                              : "Publicar aula"}
                          </Button>
                        )}

                        {isPublished && (
                          <div className="flex items-center justify-center text-[10px] text-emerald-700 font-black uppercase tracking-widest">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Disponível para o aluno
                          </div>
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
              );
            })}

            {filteredLessons?.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  Nenhuma aula encontrada
                </h3>
                <p className="text-sm text-slate-500">
                  Tente buscar por outro termo ou aguarde novas aulas serem
                  geradas.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLessonsMemory;
