import React, { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Film, Play, Sparkles, Loader2 } from "lucide-react";
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
      const { error } = await supabase.functions.invoke("tutor-lesson-structure", {
        body: { lesson_id: lesson.id },
      });
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
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["admin-tutor-lessons"] });
  };

  const triggerPublish = (lesson: any) => {
    setPublishingId(lesson.id);
    publishMutation.mutate(lesson);
  };

  // counters
  const counters = useMemo(() => {
    const list = lessons ?? [];
    return {
      total: list.length,
      published: list.filter((l: any) => l.status === "published").length,
      structuring: list.filter((l: any) => l.status === "structuring" || l.status === "in_production").length,
      pendingReview: list.filter((l: any) => l.status === "pending_review" || l.status === "ready_to_publish").length,
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
        <ProductionHeroHeader
          total={counters.total}
          published={counters.published}
          structuring={counters.structuring}
          pendingReview={counters.pendingReview}
        />

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
