import React, { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Film, Play, Sparkles, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";


import { ProductionHeroHeader } from "@/components/enaflix/admin/ProductionHeroHeader";
import { ProductionTabs } from "@/components/enaflix/admin/ProductionTabs";
import { LessonProductionCard } from "@/components/enaflix/admin/LessonProductionCard";
import { LessonDetailDrawer } from "@/components/enaflix/admin/LessonDetailDrawer";
import { Button } from "@/components/ui/button";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_MIME = [
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/x-msvideo",
];

const TABS = [
  { value: "all", label: "Todas" },
  { value: "structuring", label: "Estruturando" },
  { value: "pending_review", label: "Em revisão" },
  { value: "ready_to_publish", label: "Prontas" },
  { value: "published", label: "Publicadas" },
  { value: "archived", label: "Arquivadas" },
];

const AdminLessonsMemory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [isHealthchecking, setIsHealthchecking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadLessonId = useRef<string | null>(null);

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


  const logEvent = async (lessonId: string, eventType: string, metadata: Record<string, unknown> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tutor_lesson_events").insert([
      { lesson_id: lessonId, actor_id: user.id, event_type: eventType, metadata },
    ] as any);
  };

  const uploadVideoMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const fileName = `${id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("tutor-lesson-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "video/mp4",
        });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("tutor_lesson_memory")
        .update({ video_url: fileName, status: "ready_to_publish" })
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
      if (!lesson.video_url) throw new Error("Sem vídeo enviado");
      if (!lesson.title?.trim()) throw new Error("Título obrigatório");
      if (!lesson.subject?.trim() && !lesson.topic?.trim()) throw new Error("Informe disciplina ou tema");
      if (lesson.status !== "ready_to_publish") throw new Error(`Status inválido para publicar: ${lesson.status}`);
      const { error } = await supabase
        .from("tutor_lesson_memory")
        .update({ status: "published", published_at: new Date().toISOString() })
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

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingUploadLessonId.current;
    e.target.value = "";
    if (!file || !id) return;
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

  const pickVideo = (lesson: any) => {
    pendingUploadLessonId.current = lesson.id;
    fileInputRef.current?.click();
  };

  const handlePreview = async (lesson: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("tutor-lesson-signed-url", {
        body: { lesson_id: lesson.id },
      });
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
      const { data, error } = await supabase.functions.invoke("tutor-lesson-export", {
        body: { lesson_id: lesson.id, format },
      });
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
      const { data, error } = await supabase.functions.invoke("tutor-lesson-structure", {
        body: { lesson_id: lesson.id },
      });
      
      if (error) {
        // Handle Edge Function non-2xx or connection errors
        console.error("[Restructure] Function error:", error);
        toast.error("Erro na comunicação com o servidor de IA.");
        return;
      }

      if (data?.success === false) {
        console.error("[Restructure] Business error:", data.technical_reason);
        toast.error(data.message || "Não foi possível estruturar a aula agora.");
        queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
        return;
      }

      toast.success("Aula reestruturada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
    } catch (e: any) {
      console.error("[Restructure] Global catch:", e);
      toast.error(`Falha ao reestruturar: ${e.message ?? "erro inesperado"}`);
    }
  };

  const toggleChecklistItem = async (lesson: any, key: string) => {
    const next = { ...(lesson.quality_checklist || {}), [key]: !lesson.quality_checklist?.[key] };
    const { error } = await supabase
      .from("tutor_lesson_memory")
      .update({ quality_checklist: next })
      .eq("id", lesson.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
  };

  const triggerPublish = (lesson: any) => {
    setPublishingId(lesson.id);
    publishMutation.mutate(lesson);
  };

  const handleBatchP2 = async () => {
    if (loadingBatch) return;
    setLoadingBatch(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { generateP2LessonBatch } = await import("@/lib/p2BatchGeneration");
      await generateP2LessonBatch(user?.id || "");
      queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro na produção em lote");
    } finally {
      setLoadingBatch(false);
    }
  };

  const handleHealthcheck = async () => {
    setIsHealthchecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("tutor-lesson-structure", {
        body: { action: "healthcheck" },
      });
      if (error) throw error;
      if (data.ok) {
        toast.success("Healthcheck IA: OK", {
          description: "Banco de dados e Gateway IA operacionais.",
        });
      } else {
        toast.error("Healthcheck IA: Falha", {
          description: data.checks?.map((c: any) => `${c.name}: ${c.ok ? "OK" : "Erro"}`).join(", "),
        });
      }
    } catch (e: any) {
      toast.error(`Erro no Healthcheck: ${e.message}`);
    } finally {
      setIsHealthchecking(false);
    }
  };

  const handleReprocessFailures = async () => {
    const failures = (lessons ?? []).filter((l: any) => {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const isStuck = l.status === "structuring" && l.last_structuring_at && l.last_structuring_at < fifteenMinsAgo;
      const hasError = !!l.last_structuring_error;
      const needsAdjustment = l.status === "needs_adjustment";
      return isStuck || hasError || needsAdjustment;
    });

    if (failures.length === 0) {
      toast.info("Nenhuma aula com falha ou travada detectada.");
      return;
    }

    toast.info(`Reprocessando ${failures.length} aulas...`);
    
    // Process in sequence to avoid hitting AI rate limits too hard
    for (const failure of failures) {
      try {
        await supabase.functions.invoke("tutor-lesson-structure", {
          body: { lesson_id: failure.id },
        });
      } catch (e) {
        console.error(`Failed to reprocess lesson ${failure.id}`, e);
      }
    }
    
    toast.success("Processamento concluído.");
    queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
  };


  // counters
  const counters = useMemo(() => {
    const list = lessons ?? [];
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    return {
      total: list.length,
      published: list.filter((l: any) => l.status === "published").length,
      structuring: list.filter((l: any) => l.status === "structuring" || l.status === "in_production").length,
      pendingReview: list.filter((l: any) => l.status === "pending_review" || l.status === "ready_to_publish").length,
      stuck: list.filter((l: any) => l.status === "structuring" && l.last_structuring_at && l.last_structuring_at < fifteenMinsAgo).length,
      withErrors: list.filter((l: any) => !!l.last_structuring_error).length,
    };
  }, [lessons]);


  const tabsWithCount = useMemo(() => {
    const list = lessons ?? [];
    const count = (status: string) =>
      status === "all" ? list.length : list.filter((l: any) => l.status === status).length;
    return TABS.map((t) => ({ ...t, count: count(t.value) }));
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    const list = lessons ?? [];
    const term = searchTerm.toLowerCase().trim();
    return list.filter((l: any) => {
      if (activeTab !== "all" && l.status !== activeTab) return false;
      if (!term) return true;
      return (
        l.title?.toLowerCase().includes(term) ||
        l.subject?.toLowerCase().includes(term) ||
        l.topic?.toLowerCase().includes(term)
      );
    });
  }, [lessons, activeTab, searchTerm]);

  const openLesson = (lessons ?? []).find((l: any) => l.id === openLessonId) || null;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white relative overflow-x-hidden">
      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-violet-700/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-700/15 blur-[140px]" />
      </div>

      {/* hidden file input shared by drawer */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
        onChange={handleFileSelected}
      />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
          <div className="min-w-0 flex-1">
            <ProductionHeroHeader
              total={counters.total}
              published={counters.published}
              structuring={counters.structuring}
              pendingReview={counters.pendingReview}
            />
          </div>

          <div className="shrink-0 pb-10 flex flex-wrap gap-3 items-center xl:justify-end">
            <div className="flex flex-col gap-1 mr-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Diagnóstico & Recuperação</span>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleHealthcheck}
                  disabled={isHealthchecking}
                  className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider h-9 px-4"
                >
                  {isHealthchecking ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                  Healthcheck
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleReprocessFailures}
                  className="rounded-xl border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-300 text-[10px] font-bold uppercase tracking-wider h-9 px-4"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Reprocessar Falhas ({counters.stuck + counters.withErrors})
                </Button>
              </div>
            </div>

            <Button 
              size="lg" 
              onClick={handleBatchP2} 
              disabled={loadingBatch}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-xs h-14 px-8 rounded-2xl shadow-2xl shadow-violet-500/40 ring-4 ring-violet-500/20 gap-3 transition-all active:scale-95"
            >
              {loadingBatch ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-white" />}
              {loadingBatch ? "Processando Lote..." : "Iniciar Lote P2 Urgente"}
            </Button>
          </div>

        </div>

        {/* filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
          <ProductionTabs tabs={tabsWithCount} value={activeTab} onChange={setActiveTab} />

          <div className="lg:ml-auto relative flex items-center w-full lg:w-80 rounded-full bg-white/5 backdrop-blur-md border border-white/10 focus-within:border-violet-400/60 focus-within:bg-white/10 transition-all">
            <Search className="ml-4 h-4 w-4 text-white/50" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar aulas, disciplina, tema…"
              className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder:text-white/40 px-3 py-2.5"
            />
          </div>
        </div>

        {/* grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl border border-white/5 bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md">
            <div className="mx-auto h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <Film className="h-7 w-7 text-violet-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhuma aula nesta visão</h3>
            <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">
              Ajuste o filtro ou aguarde novas aulas serem geradas pela IA do tutor.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filteredLessons.map((lesson: any, i: number) => (
                <LessonProductionCard
                  key={lesson.id}
                  lesson={lesson}
                  index={i}
                  onOpen={(l) => setOpenLessonId(l.id)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <LessonDetailDrawer
        lesson={openLesson}
        open={!!openLessonId}
        onOpenChange={(o) => !o && setOpenLessonId(null)}
        onToggleChecklistItem={toggleChecklistItem}
        onRestructure={restructureLesson}
        onExport={exportLesson}
        onPickVideo={pickVideo}
        onPreview={handlePreview}
        onPublish={triggerPublish}
        uploadingId={uploadingId}
        publishingId={publishingId}
      />
    </div>
  );
};

export default AdminLessonsMemory;
