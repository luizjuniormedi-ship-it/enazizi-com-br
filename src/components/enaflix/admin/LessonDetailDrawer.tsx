import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Upload, PlayCircle, CheckCircle2, BookOpen, Film, Download, X, Loader2, AlertTriangle,
} from "lucide-react";

import { LessonStatusBadge } from "./LessonStatusBadge";
import { LessonChecklistRing } from "./LessonChecklistRing";
import { cn } from "@/lib/utils";

interface Props {
  lesson: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // handlers (mantêm a mesma assinatura usada pela página admin)
  onToggleChecklistItem: (lesson: any, key: string) => void;
  onRestructure: (lesson: any) => void;
  onExport: (lesson: any, format: "notebooklm" | "cinematic" | "google_vids" | "markdown" | "txt") => void;
  onPickVideo: (lesson: any) => void;
  onPreview: (lesson: any) => void;
  onPublish: (lesson: any) => void;
  uploadingId: string | null;
  publishingId: string | null;
}

export function LessonDetailDrawer({
  lesson, open, onOpenChange,
  onToggleChecklistItem, onRestructure, onExport, onPickVideo, onPreview, onPublish,
  uploadingId, publishingId,
}: Props) {
  if (!lesson) return null;

  const sc: any = lesson.structured_content ?? {};
  const isStructured = !!sc?.title;
  const hasVideo = !!lesson.video_url;
  const isPublished = lesson.status === "published";
  const checklist = (lesson.quality_checklist as any) ?? {};
  const checklistKeys = ["title_reviewed", "content_reviewed", "video_attached", "no_hallucination", "ready_to_publish"];
  const checklistComplete = checklistKeys.every((k) => !!checklist[k]);
  const canPublish = lesson.status === "ready_to_publish" && checklistComplete && hasVideo;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-[#0a0a12]/95 border-l border-white/10 backdrop-blur-2xl text-white p-0"
      >
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px]" />

        <div className="relative flex h-full flex-col">
          {/* header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <LessonStatusBadge status={lesson.status} />
                  {isStructured && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      <Sparkles className="h-3 w-3" /> Estruturada IA
                    </span>
                  )}
                  {lesson.generated_from_real_usage && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                      <Sparkles className="h-3 w-3" /> Comportamento Real
                    </span>
                  )}
                </div>
                <SheetTitle className="text-2xl font-black text-white leading-tight">
                  {lesson.title || "Sem título"}
                </SheetTitle>
                <p className="mt-1 text-xs uppercase tracking-widest text-violet-300/70 font-bold">
                  {lesson.subject || "Medicina"} {lesson.topic ? `· ${lesson.topic}` : ""}
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          {/* tabs */}
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 bg-white/5 border border-white/10">
              <TabsTrigger value="overview" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-white">Resumo</TabsTrigger>
              <TabsTrigger value="content" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-white">Conteúdo</TabsTrigger>
              <TabsTrigger value="prompts" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-white">Prompts</TabsTrigger>
              <TabsTrigger value="actions" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-white">Ações</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-6 py-5">
              <TabsContent value="overview" className="space-y-5 mt-0">
                <LessonChecklistRing
                  checklist={checklist}
                  onToggle={(key) => onToggleChecklistItem(lesson, key)}
                  disabled={isPublished}
                />

                {sc?.objective && (
                  <Section title="Objetivo">
                    <p className="text-sm text-white/75 leading-relaxed">{sc.objective}</p>
                  </Section>
                )}
                {sc?.summary && (
                  <Section title="Resumo IA">
                    <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{sc.summary}</p>
                  </Section>
                )}
                {Array.isArray(sc?.objectives) && sc.objectives.length > 0 && (
                  <Section title="Objetivos pedagógicos">
                    <ul className="space-y-1.5 text-sm text-white/75">
                      {sc.objectives.map((o: string, i: number) => (
                        <li key={i} className="flex gap-2"><span className="text-violet-300">→</span> {o}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {Array.isArray(sc?.pitfalls) && sc.pitfalls.length > 0 && (
                  <Section title="Pegadinhas clássicas">
                    <ul className="space-y-1.5 text-sm text-white/75">
                      {sc.pitfalls.map((p: string, i: number) => (
                        <li key={i} className="flex gap-2"><span className="text-amber-300">!</span> {p}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {lesson.last_structuring_error && (
                  <Section title="Último Erro de Estruturação">
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-200">Falha na IA</span>
                      </div>
                      <p className="text-xs text-rose-100/90 leading-relaxed font-mono">{lesson.last_structuring_error}</p>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => onRestructure(lesson)}
                        className="mt-2 h-7 text-[10px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 px-2 uppercase font-black"
                      >
                        Tentar novamente agora
                      </Button>
                    </div>
                  </Section>
                )}

                {lesson.metadata?.ai_suggested_topic && (
                  <Section title="Sugestão Divergente da IA">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">Topic Preservado</span>
                      </div>
                      <p className="text-xs text-amber-100/90 leading-relaxed">
                        A IA sugeriu o tema <strong>"{lesson.metadata.ai_suggested_topic}"</strong>, mas mantivemos o original <strong>"{lesson.topic}"</strong> para evitar conflitos.
                      </p>
                    </div>
                  </Section>
                )}

                {lesson.generation_reason && (
                  <Section title="Motivo da Geração (Voz do Aluno)">
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-200">Insight Pedagógico</span>
                      </div>
                      <p className="text-sm text-white font-medium leading-relaxed">{lesson.generation_reason}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Metric label="Sessões de Estudo" value={lesson.study_sessions_count} />
                      <Metric label="Interações Tutor" value={lesson.tutor_messages_count} />
                      <Metric label="Erros no Banco" value={lesson.related_error_bank_count} />
                      <Metric label="Score de Interesse" value={`${lesson.pedagogical_interest_score}%`} />
                    </div>
                  </Section>
                )}

              </TabsContent>

              <TabsContent value="content" className="space-y-5 mt-0">
                {Array.isArray(sc?.chapters) && sc.chapters.length > 0 && (
                  <Section title="Capítulos">
                    <ol className="space-y-2">
                      {sc.chapters.map((ch: any, i: number) => (
                        <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[10px] uppercase tracking-widest text-violet-300/70 font-bold">Cap. {i + 1}</div>
                          <div className="text-sm text-white font-bold mt-0.5">{ch.title || ch.name || "Capítulo"}</div>
                          {ch.summary && <p className="text-xs text-white/55 mt-1">{ch.summary}</p>}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}
                {sc?.script && (
                  <Section title="Roteiro">
                    <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed bg-white/[0.03] border border-white/10 rounded-xl p-3 max-h-96 overflow-auto">
                      {typeof sc.script === "string" ? sc.script : JSON.stringify(sc.script, null, 2)}
                    </pre>
                  </Section>
                )}
                {Array.isArray(sc?.flashcards) && sc.flashcards.length > 0 && (
                  <Section title={`Flashcards (${sc.flashcards.length})`}>
                    <div className="space-y-2">
                      {sc.flashcards.slice(0, 6).map((f: any, i: number) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-white font-bold">{f.front || f.question}</div>
                          <div className="text-xs text-white/55 mt-1">{f.back || f.answer}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {Array.isArray(sc?.quiz) && sc.quiz.length > 0 && (
                  <Section title={`Quiz (${sc.quiz.length} questões)`}>
                    <div className="text-xs text-white/55">Disponível na publicação para o aluno.</div>
                  </Section>
                )}
                {!isStructured && (
                  <div className="text-sm text-white/50 text-center py-8">
                    Aula ainda não estruturada. Use a aba <span className="text-violet-300 font-bold">Ações</span> para gerar.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prompts" className="space-y-5 mt-0">
                {sc?.cinematic_video_prompt && (
                  <Section title="Prompt Vídeo Cinematográfico">
                    <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed bg-white/[0.03] border border-white/10 rounded-xl p-3">{sc.cinematic_video_prompt}</pre>
                  </Section>
                )}
                {sc?.notebooklm_prompt && (
                  <Section title="Prompt NotebookLM">
                    <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed bg-white/[0.03] border border-white/10 rounded-xl p-3">{sc.notebooklm_prompt}</pre>
                  </Section>
                )}
                {!sc?.cinematic_video_prompt && !sc?.notebooklm_prompt && (
                  <div className="text-sm text-white/50 text-center py-8">
                    Sem prompts dedicados nesta aula.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-0">
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-violet-200">Pipeline de Produção IA</h4>
                  </div>
                  <p className="text-xs text-violet-100/70 mb-4 leading-relaxed">
                    Esta aula foi detectada automaticamente. Use o botão abaixo para gerar toda a estrutura cinematográfica (roteiro, capítulos e prompts de vídeo).
                  </p>
                  <Button 
                    onClick={() => onRestructure(lesson)}
                    className="w-full bg-violet-500 hover:bg-violet-400 text-white font-black uppercase tracking-widest text-[10px] h-10 gap-2 shadow-[0_0_20px_-5px_rgba(139,92,246,0.6)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Gerar Estrutura Cinematográfica
                  </Button>
                </div>

                <div className="h-px bg-white/5 my-2" />
                <Section title="Exportações de Vídeo">
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <ActionPill icon={<BookOpen className="h-4 w-4" />} label="NotebookLM" onClick={() => onExport(lesson, "notebooklm")} disabled={!isStructured} />
                      <ActionPill icon={<Sparkles className="h-4 w-4" />} label="Vídeo Cinematográfico" onClick={() => onExport(lesson, "cinematic")} disabled={!isStructured} />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <ActionPill icon={<Download className="h-4 w-4" />} label="Markdown" onClick={() => onExport(lesson, "markdown")} disabled={!isStructured} />
                    </div>
                  </div>
                </Section>

                <ActionPill
                  icon={uploadingId === lesson.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  label={hasVideo ? "Substituir vídeo" : "Subir vídeo"}
                  hint="MP4, WebM, MOV, MKV ou AVI · até 500 MB"
                  onClick={() => onPickVideo(lesson)}
                  accent="amber"
                  disabled={uploadingId === lesson.id}
                />

                {hasVideo && (
                  <ActionPill
                    icon={<PlayCircle className="h-4 w-4" />}
                    label="Preview seguro"
                    onClick={() => onPreview(lesson)}
                  />
                )}

                {!isPublished && (
                  <Button
                    onClick={() => onPublish(lesson)}
                    disabled={!canPublish || publishingId === lesson.id}
                    className={cn(
                      "w-full h-12 text-sm font-black uppercase tracking-widest gap-2",
                      "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white",
                      "shadow-[0_0_24px_-6px_rgba(16,185,129,0.7)]",
                      "disabled:bg-white/5 disabled:bg-none disabled:text-white/30 disabled:shadow-none",
                    )}
                  >
                    {publishingId === lesson.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {publishingId === lesson.id ? "Publicando…" : "Publicar para os alunos"}
                  </Button>
                )}

                {isPublished && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3 text-xs font-black uppercase tracking-widest text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Disponível para o aluno
                  </div>
                )}

                {!canPublish && !isPublished && (
                  <p className="text-[11px] text-amber-300/80 text-center">
                    Conclua o checklist e o upload do vídeo para liberar a publicação.
                  </p>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function ActionPill({
  icon, label, hint, onClick, disabled, accent,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "violet" | "amber" | "default";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all backdrop-blur-md",
        "border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20",
        accent === "violet" && "hover:border-violet-400/40 hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.6)]",
        accent === "amber" && "hover:border-amber-400/40 hover:shadow-[0_0_24px_-8px_rgba(245,158,11,0.5)]",
        disabled && "opacity-40 cursor-not-allowed hover:bg-white/[0.03] hover:border-white/10 hover:shadow-none",
      )}
    >
      <span className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white",
        accent === "violet" && "text-violet-200 group-hover:bg-violet-500/20",
        accent === "amber" && "text-amber-200 group-hover:bg-amber-500/20",
      )}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-white">{label}</span>
        {hint && <span className="block text-[11px] text-white/50 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}
