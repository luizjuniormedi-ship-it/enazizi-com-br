import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  FileUp, 
  FileText, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  Send,
  History,
  LayoutDashboard,
  Database,
  BarChart3,
  Loader2,
  MoreVertical,
  Filter,
  Zap,
  UserCog,
  Youtube,
  Globe,
  Check,
  X,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Video,
  Music,
  Download,
  Share2,
  TrendingUp,
  RotateCcw,
  FileJson,
  Activity,
  DollarSign,
  Package,
  Settings
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { PedagogicalQualityDashboard } from "@/components/admin/PedagogicalQualityDashboard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { motion } from "framer-motion";

export function AIStudio() {
   const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recent");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  
  // Review form states
  // Review form states (0-10 scale)
  const [reviewScore, setReviewScore] = useState(10);
  const [reviewLabel, setReviewLabel] = useState("Excelente");
  const [reviewPrecision, setReviewPrecision] = useState(10);
  const [reviewDidactic, setReviewDidactic] = useState(10);
  const [reviewClarity, setReviewClarity] = useState(10);
  const [reviewDepth, setReviewDepth] = useState(10);
  const [reviewFlashcards, setReviewFlashcards] = useState(10);
  const [reviewQuiz, setReviewQuiz] = useState(10);
  const [reviewFeynman, setReviewFeynman] = useState(10);
  const [reviewAdherence, setReviewAdherence] = useState(10);
  const [reviewSafety, setReviewSafety] = useState(10);
  const [reviewExamUtility, setReviewExamUtility] = useState(10);
  const [reviewType, setReviewType] = useState("pedagogical");
  const [reviewHallucination, setReviewHallucination] = useState("none");
  const [reviewComments, setReviewComments] = useState("");

  // Form states for new content
  const [newTitle, setNewTitle] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newSourceType, setNewSourceType] = useState("text");
  const [newRawContent, setNewRawContent] = useState("");

  // Queries
  const { data: libraryContent, isLoading: isLoadingLibrary } = useQuery({
    queryKey: ["master-content-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: queueItems, isLoading: isLoadingQueue } = useQuery({
    queryKey: ["ai-generation-queue"],
    queryFn: async () => {
      // Checking for existence of queue table - fallback if not found
      try {
        const { data, error } = await supabase
          .from("ai_generation_queue")
          .select("*, master_content_library(title)")
          .order("created_at", { ascending: false });
        if (error) return [];
        return data;
      } catch (e) {
        return [];
      }
    }
  });

  const generateAIContent = useMutation({
    mutationFn: async ({ contentId, isRetry = false }: { contentId: string, isRetry?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-content-ai', {
        body: { contentId, isRetry }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message || "Geração concluída com sucesso.");
      } else {
        toast.info(data?.message || "Processamento em andamento.");
      }
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      queryClient.invalidateQueries({ queryKey: ["ai-generation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ai-usage-logs"] });
    },
    onError: (error) => {
      toast.error("Erro no pipeline: " + error.message);
    }
  });

  const { data: usageLogsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["ai-usage-logs-detailed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*, master_content_library(title, discipline)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  const { data: exportLogs } = useQuery({
    queryKey: ["ai-export-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_export_logs")
        .select("*, master_content_library(title)")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data;
    }
  });

  const trackExport = useMutation({
    mutationFn: async ({ contentId, destination }: { contentId: string, destination: string }) => {
      // Registrar log oficial de exportação NotebookLM
      const { error } = await supabase
        .from("notebooklm_export_logs")
        .insert([{ 
          content_id: contentId, 
          user_id: user?.id, 
          status: 'exported',
          metadata: { destination }
        }]);
      if (error) throw error;
      
      await supabase
        .from("master_content_library")
        .update({ 
          media_status: 'exported_to_notebooklm',
          exported_by: user?.id,
          exported_at: new Date().toISOString()
        })
        .eq('id', contentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooklm-export-logs"] });
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
    }
  });

  const updateMultimedia = useMutation({
    mutationFn: async ({ contentId, audioUrl, videoUrl }: { contentId: string, audioUrl?: string, videoUrl?: string }) => {
      const status = audioUrl && videoUrl ? 'ready_for_students' : (audioUrl ? 'audio_linked' : 'none');
      const { error } = await supabase
        .from("master_content_library")
        .update({ 
          notebooklm_audio_url: audioUrl, 
          notebooklm_video_url: videoUrl,
          media_status: status,
          media_added_by: user?.id,
          media_added_at: new Date().toISOString()
        })
        .eq('id', contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ativos multimídia atualizados!");
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
    }
  });

  const createContent = useMutation({
    mutationFn: async () => {
      const contentHash = btoa(newRawContent.slice(0, 100) + newTitle).slice(0, 32);
      
      // Check for existing content (Reuse/Cache logic)
      const { data: existing } = await supabase
        .from("master_content_library")
        .select("id, title")
        .eq("content_hash", contentHash)
        .single();

      if (existing) {
        toast.info(`Conteúdo reutilizado da Biblioteca Mestre: ${existing.title}`);
        return existing;
      }

      const { data, error } = await supabase
        .from("master_content_library")
        .insert([{
          title: newTitle,
          discipline: newDiscipline,
          topic: newTopic,
          source_type: newSourceType,
          raw_content: newRawContent,
          content_hash: contentHash,
          status: 'processing',
          created_by: user?.id,
          metadata: { version: '1.0.0', audit: 'ready' }
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Conteúdo criado com sucesso!");
      setIsUploadOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      // Trigger AI generation
      generateAIContent.mutate({ contentId: data.id });
    }
  });

  const publishContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("master_content_library")
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo publicado para os alunos!");
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      setIsReviewOpen(false);
    }
  });

  const submitReview = useMutation({
    mutationFn: async (reviewData: { 
      contentId: string, 
      score: number, 
      label: string, 
      precision: number,
      clarity: number,
      depth: number,
      flashcards: number,
      quiz: number,
      feynman: number,
      didactic: number, 
      adherence: number,
      safety: number,
      examUtility: number,
      reviewType: string,
      hallucination: string,
      comments: string 
    }) => {
      const { error } = await supabase
        .from("pedagogical_reviews")
        .insert([{
          content_id: reviewData.contentId,
          reviewer_id: user?.id,
          score: reviewData.score,
          quality_label: reviewData.label,
          precision_score: reviewData.precision,
          clarity_score: reviewData.clarity,
          depth_score: reviewData.depth,
          flashcards_quality_score: reviewData.flashcards,
          quiz_quality_score: reviewData.quiz,
          feynman_quality_score: reviewData.feynman,
          didactic_score: Math.round(reviewData.didactic / 2), // DB is 1-5 for didactic
          adherence_to_guidelines_score: reviewData.adherence,
          clinical_safety_score: reviewData.safety,
          exam_utility_score: reviewData.examUtility,
          review_type: reviewData.reviewType,
          hallucination_risk: reviewData.hallucination,
          comments: reviewData.comments
        }]);
      if (error) throw error;

      // Update content status based on review type
      let newStatus = 'pedagogical_review';
      if (reviewData.reviewType === 'scientific') newStatus = 'scientific_review';
      if (reviewData.label === 'Excelente' && reviewData.reviewType === 'scientific') newStatus = 'approved';
      if (reviewData.label === 'Reprovado') newStatus = 'rejected';

      await supabase
        .from("master_content_library")
        .update({ status: newStatus as any })
        .eq("id", reviewData.contentId);
    },
    onSuccess: () => {
      toast.success("Auditoria Médica registrada!");
      queryClient.invalidateQueries({ queryKey: ["master-content-library"] });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-stats-v2"] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar auditoria: " + error.message);
    }
  });

  const { data: usageLogs } = useQuery({
    queryKey: ["ai-usage-logs"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("ai_enterprise_usage_logs" as any).select("*");
        if (error) return [];
        return data as any[];
      } catch (e) {
        return [];
      }
    }
  });

  const { data: operationalAlerts } = useQuery({
    queryKey: ["ai-operational-alerts-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_operational_alerts")
        .select("*")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data;
    }
  });

  const stats = {
    total: libraryContent?.length || 0,
    published: libraryContent?.filter(c => c.status === "published").length || 0,
    review: libraryContent?.filter(c => ["ai_generated", "pedagogical_review", "scientific_review"].includes(c.status)).length || 0,
    processing: libraryContent?.filter(c => c.status === "processing").length || 0,
    failed: libraryContent?.filter(c => c.status === "failed").length || 0,
    savings: usageLogs?.reduce((acc: number, log: any) => acc + (log.cache_status !== 'cache_miss' ? 0.50 : 0), 0) || 0,
    cost: usageLogs?.reduce((acc: number, log: any) => acc + Number(log.estimated_cost || 0), 0) || 0,
    alerts: operationalAlerts?.length || 0,
    blocked: libraryContent?.filter(c => (c.hallucination_risk_score || 0) > 0.7).length || 0
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Publicado</Badge>;
      case "review": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Em Revisão</Badge>;
      case "processing": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse">Processando</Badge>;
      case "failed": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Falha</Badge>;
      case "approved": return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Aprovado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportPDF = async (content: any) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("ENAZIZI - Central de Produção IA", margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`v1.5 Production Ready - Geração: ${new Date().toLocaleString('pt-BR')}`, margin, y);
    y += 15;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(content.title || "Sem Título", margin, y);
    y += 10;

    // Metadata
    doc.setFontSize(10);
    doc.text(`Disciplina: ${content.discipline || "N/A"}`, margin, y);
    y += 5;
    doc.text(`Tópico: ${content.topic || "N/A"}`, margin, y);
    y += 10;

    // Content sections
    const sections = [
      { title: "Resumo Técnico", content: content.generated_summary },
      { title: "Explicação Feynman", content: content.generated_feynman },
      { title: "Roteiro NotebookLM", content: content.notebooklm_export_text }
    ];

    sections.forEach(section => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, margin, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(section.content || "Conteúdo não disponível.", 170);
      doc.text(splitText, margin, y);
      y += (splitText.length * 5) + 10;
    });

    doc.save(`ENAZIZI_${content.title.replace(/\s+/g, '_')}.pdf`);
    
    supabase.rpc('log_ai_alert', { 
      p_type: 'pdf_export', 
      p_severity: 'info', 
      p_message: `PDF exportado para: ${content.title}`,
      p_content_id: content.id
    });
    
    toast.success("PDF gerado e exportado!");
  };

  const handleCopyNotebookLM = (content: any) => {
    // Validação de Governança
    if (content.status !== 'published' && content.status !== 'approved') {
      toast.error("Apenas conteúdos aprovados ou publicados podem ser exportados.");
      return;
    }

    if ((content.hallucination_risk_score || 0) > 0.4) {
      toast.warning("Risco de alucinação elevado. Revise antes de exportar.");
    }

    const text = `
# PACOTE EDUCACIONAL ENAZIZI -> NOTEBOOKLM v1.5
ID CONTEÚDO: ${content.id}

---
## 1. CABEÇALHO E OBJETIVOS
- Título da Aula: ${content.title}
- Especialidade Médica: ${content.discipline}
- Data: ${new Date().toLocaleDateString('pt-BR')}

OBJETIVOS DE APRENDIZAGEM:
1. Consolidar conceitos fundamentais de ${content.topic}.
2. Aplicar diretrizes clínicas atualizadas na prática médica.
3. Identificar pontos críticos para exames de residência médica.

---
## 2. RESUMO TÉCNICO PROFUNDO (CORPO DA AULA)
${content.generated_summary || "Conteúdo técnico pendente."}

---
## 3. EXPLICAÇÃO FEYNMAN (CONCEITOS COMPLEXOS SIMPLIFICADOS)
${content.generated_feynman || "Explicação simplificada pendente."}

---
## 4. PONTOS DE PROVA E RESUMO CLÍNICO
CONCEITOS-CHAVE:
- Tema Central: ${content.topic}
- Especialidade: ${content.discipline} avançado.

PONTOS DE ATENÇÃO (HIGH-YIELD):
${Array.isArray(content.generated_questions) ? 
  content.generated_questions.map((q: any) => `- ${q.question || q.pergunta}`).join('\n') : 
  "Questões de revisão pendentes."}

---
## 5. FLASHCARDS E REVISÃO RÁPIDA (CONSOLIDAÇÃO)
${Array.isArray(content.generated_flashcards) ? 
  content.generated_flashcards.map((f: any, i: number) => `Q${i+1}: ${f.front || f.pergunta}\nA${i+1}: ${f.back || f.resposta}`).join('\n\n') : 
  "Flashcards pendentes."}

---
## 6. QUIZ DE AUTOAVALIAÇÃO
${Array.isArray(content.generated_quiz) ? 
  content.generated_quiz.slice(0, 5).map((q: any, i: number) => `${i+1}. ${q.question || q.pergunta}\nOpções: ${(q.options || q.alternativas || []).join(', ')}`).join('\n\n') : 
  "Quiz pendente."}

---
## 7. ROTEIROS MULTIMÍDIA E INSTRUÇÕES
### ROTEIRO DE ÁUDIO (PODCAST / AUDIO OVERVIEW)
${content.generated_video_script || "Roteiro pendente."}

### INSTRUÇÕES PARA AUDIO OVERVIEW (NOTEBOOKLM):
"Por favor, gere um diálogo estilo 'Deep Dive' entre dois especialistas médicos sobre este material. Foque na clareza didática, raciocínio clínico e condutas terapêuticas de última linha."

### INSTRUÇÕES PARA GUIA INTERATIVO:
"Crie um guia de estudos interativo que destaque os diagnósticos diferenciais e as pegadinhas de prova mais comuns citadas neste material."
    `;

    navigator.clipboard.writeText(text);
    
    // Registrar exportação
    trackExport.mutate({ contentId: content.id, destination: 'notebooklm' });
    
    // Alerta operacional
    supabase.rpc('log_ai_alert', { 
      p_type: 'notebooklm_export', 
      p_severity: 'info', 
      p_message: `Pacote NotebookLM v1.5 exportado: ${content.title}`,
      p_content_id: content.id
    });

    toast.success("Pacote estruturado v1.5 copiado para o NotebookLM!");
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary uppercase">Enterprise</Badge>
            <Badge variant="outline" className="text-[10px] border-indigo-500/20 text-indigo-500 uppercase">NotebookLM Sync</Badge>
            <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20 uppercase font-bold tracking-tighter">v1.0 Production Ready</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-primary/60 bg-clip-text text-transparent">
            Central de Produção IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Geração de conteúdo pedagógico e sincronização com Google NotebookLM Pro.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-glow-sm">
                <Plus className="h-4 w-4" />
                Novo Conteúdo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border-primary/10">
              <DialogHeader>
                <DialogTitle>Produzir Novo Material IA</DialogTitle>
                <DialogDescription>
                  Envie arquivos ou texto para gerar resumos, flashcards e simulados automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Disciplina</Label>
                    <Input placeholder="Ex: Cardiologia" value={newDiscipline} onChange={e => setNewDiscipline(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input placeholder="Ex: Arritmias" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título do Material</Label>
                  <Input placeholder="Título identificador" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Fonte</Label>
                  <Select value={newSourceType} onValueChange={setNewSourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto / Link</SelectItem>
                      <SelectItem value="pdf">Documento PDF</SelectItem>
                      <SelectItem value="youtube">Vídeo YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo Bruto / Link</Label>
                  <Textarea 
                    placeholder="Cole o texto, link do YouTube ou descrição do arquivo..." 
                    className="min-h-[150px] font-mono text-xs"
                    value={newRawContent}
                    onChange={e => setNewRawContent(e.target.value)}
                  />
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-500/80 italic">
                    Ao confirmar, a engine de IA OpenAI processará o conteúdo. O sistema verificará automaticamente se este material já existe na Biblioteca Mestre para evitar custos duplicados.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={() => createContent.mutate()} 
                  disabled={createContent.isPending || !newTitle || !newRawContent}
                  className="gap-2"
                >
                  {createContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Iniciar Produção IA
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => window.location.href='/admin/notebooklm-sync'} className="gap-2">
            <Music className="h-4 w-4" />
            Sync Multimídia
          </Button>

          <Button variant="outline" onClick={() => window.location.href='/admin/ai-audit-mode'} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Modo Auditoria
          </Button>

          <Button variant="outline" onClick={() => setActiveTab("library")} className="gap-2">
            <Database className="h-4 w-4" />
            Biblioteca Mestre
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Calibração de Lote v1.0 (Audit)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">
                {libraryContent?.filter(c => c.status === 'published' || c.status === 'review').length || 0} / 10 PDFs
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Calibre a qualidade real rodando 10 materiais médicos de especialidades diferentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['Cardio', 'Pneumo', 'Farmaco', 'Pedia', 'GO', 'Clínica', 'Cirurgia', 'Neuro', 'Prev', 'Emerg'].map((spec) => {
                const isDone = libraryContent?.some(c => c.discipline?.toLowerCase().includes(spec.toLowerCase()) && (c.status === 'published' || c.status === 'review'));
                return (
                  <div key={spec} className={`flex items-center gap-2 p-2 rounded border text-[10px] transition-colors ${isDone ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-background/50 border-primary/10 text-muted-foreground'}`}>
                    {isDone ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current" />}
                    {spec}
                  </div>
                );
              })}
            </div>
            <Progress value={((libraryContent?.filter(c => c.status === 'published' || c.status === 'review').length || 0) / 10) * 100} className="h-1.5 mt-4" />
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Status de Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Prompt Especializado</span>
              <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/20 h-5 px-1.5 text-[10px]">Ativo</Badge>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Cache de Reuso</span>
              <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/20 h-5 px-1.5 text-[10px]">Ativo</Badge>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Auditoria Pedagógica</span>
              <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/20 h-5 px-1.5 text-[10px]">Ativo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas Ativos</p>
                <h3 className={`text-2xl font-bold ${stats.alerts > 0 ? "text-destructive" : "text-primary"}`}>{stats.alerts}</h3>
              </div>
              <div className={`p-2 rounded-lg ${stats.alerts > 0 ? "bg-destructive/10" : "bg-primary/10"}`}>
                <AlertCircle className={`h-5 w-5 ${stats.alerts > 0 ? "text-destructive" : "text-primary"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aguardando Revisão</p>
                <h3 className="text-2xl font-bold text-amber-500">{stats.review}</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <History className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bloqueados (Risco)</p>
                <h3 className="text-2xl font-bold text-destructive">{stats.blocked}</h3>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Publicados</p>
                <h3 className="text-2xl font-bold text-green-500">{stats.published}</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-500/5 backdrop-blur-sm border-indigo-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-500/70">Economia Cache</p>
                <h3 className="text-xl font-bold text-indigo-500">$ {stats.savings.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 backdrop-blur-sm border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-500/70">Custo Total</p>
                <h3 className="text-xl font-bold text-amber-500">$ {stats.cost.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Studio Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4 border-b border-primary/5 pb-2">
          <TabsList className="bg-transparent gap-2 h-auto p-0">
            <TabsTrigger 
              value="recent" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Recentes
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <Database className="h-4 w-4 mr-2" />
              Biblioteca Completa
            </TabsTrigger>
            <TabsTrigger 
              value="queue" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <History className="h-4 w-4 mr-2" />
              Fila de Geração
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics & Custos
            </TabsTrigger>
            <TabsTrigger 
              value="quality" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger 
              value="logs" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <FileJson className="h-4 w-4 mr-2" />
              Logs IA
            </TabsTrigger>
            <TabsTrigger 
              value="prompts" 
              className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              <Zap className="h-4 w-4 mr-2" />
              Prompts
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar conteúdo..." className="pl-9 w-[200px] lg:w-[300px] h-9" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="recent" className="mt-0">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4">
              <Card className="border-primary/5 bg-card/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Últimos Conteúdos</CardTitle>
                      <CardDescription>Acompanhe o status dos últimos arquivos processados.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingLibrary ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                  ) : libraryContent?.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Nenhum conteúdo encontrado.</p>
                      <Button variant="link" onClick={() => setIsUploadOpen(true)}>Clique aqui para começar</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {libraryContent?.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-primary/5 hover:border-primary/20 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/5 rounded border border-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.discipline || item.source_type}</span>
                                <span className="text-[10px] text-muted-foreground">•</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {getStatusBadge(item.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedContent(item); setIsReviewOpen(true); }}>
                                  <Eye className="h-4 w-4 mr-2" /> Visualizar / Revisar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generateAIContent.mutate({ contentId: item.id, isRetry: true })}>
                                  <RotateCcw className="h-4 w-4 mr-2" /> Tentar Novamente (Retry)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyNotebookLM(item)}>
                                  <Copy className="h-4 w-4 mr-2" /> Exportar NotebookLM
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-primary" onClick={async () => {
                                  const { data, error } = await supabase
                                    .from('ai_video_lessons')
                                    .insert({
                                      title: item.title,
                                      specialty: item.discipline || 'Geral',
                                      topic: item.topic || 'Geral',
                                      description: item.generated_summary,
                                      tutor_lesson_summary: item.generated_feynman,
                                      notebooklm_export_text: item.notebooklm_export_text,
                                      status: 'tutor_lesson_saved'
                                    })
                                    .select()
                                    .single();
                                  
                                  if (error) {
                                    toast.error("Erro ao converter para Videoaula: " + error.message);
                                  } else {
                                    toast.success("Aula vinculada ao módulo de Videoaulas!");
                                    navigate("/admin/video-lessons");
                                  }
                                }}>
                                  <Video className="h-4 w-4 mr-2" /> Transformar em Videoaula
                                </DropdownMenuItem>
                                {item.status === 'review' && (
                                  <DropdownMenuItem className="text-primary" onClick={() => publishContent.mutate(item.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Publicar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                      <Button variant="ghost" className="w-full text-xs text-muted-foreground mt-2" onClick={() => setActiveTab("library")}>
                        Ver todos os conteúdos
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick AI Toolbox */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-primary/5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      Gerar Novos Flashcards
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select onValueChange={(val) => generateAIContent.mutate({ contentId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um conteúdo mestre" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-indigo-500 hover:bg-indigo-600" disabled={generateAIContent.isPending}>
                      {generateAIContent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Gerar Flashcards (FSRS)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-primary/5 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-emerald-500" />
                      Extrair Questões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select onValueChange={(val) => generateAIContent.mutate({ contentId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        {libraryContent?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600" disabled={generateAIContent.isPending}>
                       {generateAIContent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                       Criar Banco de Questões
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sidebar with Generation Queue */}
            <Card className="border-primary/5 bg-card/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Fila Ativa</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{stats.processing} tarefas</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingQueue ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                  </div>
                ) : queueItems?.filter(q => q.status !== "completed").length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-primary/5 rounded-xl border border-primary/10">
                    <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Nenhuma tarefa em execução.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queueItems?.filter(q => q.status !== "completed").slice(0, 4).map((task) => (
                      <div key={task.id} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate max-w-[150px]">{task.master_content_library?.title}</span>
                          <span className="text-primary animate-pulse">{task.status === 'processing' ? 'Processando' : 'Na fila'}</span>
                        </div>
                        <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary animate-shimmer" 
                            style={{ width: task.status === 'processing' ? '65%' : '10%' }} 
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-widest">
                          <Zap className="h-2 w-2" />
                          {task.task_type.replace('_', ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-8 pt-6 border-t border-primary/5 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Info Pedagógica</h4>
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Todo conteúdo IA deve ser revisado antes da publicação. Alunos verão a tag "Revisado pela Equipe Pedagógica".
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="library">
           {/* Comprehensive list of content with advanced filtering */}
           <Card className="border-primary/5">
              <CardContent className="p-0">
                <div className="divide-y divide-primary/5">
                  {libraryContent?.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> Admin: {item.created_by?.slice(0, 8)}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block mr-4">
                          <p className="text-xs font-medium">Custo Estimado</p>
                          <p className="text-xs text-muted-foreground">$ {item.estimated_cost?.toFixed(2) || "0.00"}</p>
                        </div>
                        {getStatusBadge(item.status)}
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedContent(item); setIsReviewOpen(true); }}>Gerenciar</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExportPDF(item)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Exportar PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyNotebookLM(item)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                NotebookLM Sync
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateAIContent.mutate({ contentId: item.id, isRetry: true })}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Regerar IA
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
             <Card className="border-primary/5">
               <CardHeader>
                 <CardTitle className="text-base">Distribuição de Conteúdo</CardTitle>
               </CardHeader>
               <CardContent className="h-[300px] flex items-center justify-center border-t border-primary/5">
                 <p className="text-muted-foreground text-sm">Gráfico de distribuição por tipo será renderizado aqui.</p>
               </CardContent>
             </Card>
             <Card className="border-primary/5">
               <CardHeader>
                 <CardTitle className="text-base">Evolução de Custos (30 dias)</CardTitle>
               </CardHeader>
               <CardContent className="h-[300px] flex items-center justify-center border-t border-primary/5">
                 <p className="text-muted-foreground text-sm">Gráfico de evolução financeira será renderizado aqui.</p>
               </CardContent>
             </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="py-4">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Governança de Prompts v1.0
              </CardTitle>
              <CardDescription>Gerenciamento de prompts especializados e versionados por área médica.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Prompt
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Nome/Versão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">Cardiologia</TableCell>
                      <TableCell>SBC-AHA-v2.1</TableCell>
                      <TableCell><Badge className="bg-green-500/10 text-green-500">Ativo</Badge></TableCell>
                      <TableCell className="text-xs">30/04/2026</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Editar</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Geral</TableCell>
                      <TableCell>Standard-v1.0</TableCell>
                      <TableCell><Badge variant="outline">Inativo</Badge></TableCell>
                      <TableCell className="text-xs">15/04/2026</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Editar</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="py-4">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileJson className="h-5 w-5 text-primary" />
                Rastreabilidade de Inteligência OpenAI v2.0
              </CardTitle>
              <CardDescription>Logs detalhados de cada chamada de IA, latência e validação de JSON.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>JSON</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Latência</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageLogsData?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-[11px] font-mono">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs truncate max-w-[200px]">{log.master_content_library?.title}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{log.master_content_library?.discipline}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.status === 'success' ? 
                            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px]">Success</Badge> : 
                            <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                          }
                          {log.reused_from_cache && <Badge variant="outline" className="ml-1 text-[10px] border-blue-500/20 text-blue-500">Cache</Badge>}
                        </TableCell>
                        <TableCell>
                          {log.json_validation_status === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {log.json_validation_status === 'repaired' && <Zap className="h-4 w-4 text-amber-500" />}
                          {log.json_validation_status === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {log.input_tokens + log.output_tokens || 0}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-green-600">
                          ${log.estimated_cost?.toFixed(5) || '0.00000'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4 py-4">
          <PedagogicalQualityDashboard />
        </TabsContent>
      </Tabs>

      {/* Content Review & NotebookLM Export Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 bg-card">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">{selectedContent?.title}</DialogTitle>
                <DialogDescription>{selectedContent?.discipline} • {selectedContent?.topic}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedContent && getStatusBadge(selectedContent.status)}
                <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedContent)}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopyNotebookLM(selectedContent)}>
                  <Copy className="h-4 w-4 mr-2" /> NotebookLM
                </Button>
                {selectedContent?.status !== 'published' && (
                  <Button size="sm" onClick={() => publishContent.mutate(selectedContent.id)}>
                    Publicar Agora
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <TabsList className="px-6 bg-transparent border-b rounded-none h-12 gap-4">
                <TabsTrigger value="overview">Resumo Técnico</TabsTrigger>
                <TabsTrigger value="feynman">Feynman</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                 <TabsTrigger value="quiz">Quiz / Questões</TabsTrigger>
                <TabsTrigger value="multimedia" className="text-blue-500">Multimídia</TabsTrigger>
                <TabsTrigger value="pedagogical" className="text-green-500">Auditoria</TabsTrigger>
                <TabsTrigger value="notebooklm" className="text-indigo-500">NotebookLM</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-6">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {selectedContent?.generated_summary || "O conteúdo ainda está sendo processado pela IA..."}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="feynman" className="mt-0">
                  <div className="p-6 rounded-xl bg-primary/5 border border-primary/10">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" /> Técnica Feynman (Simplicidade)
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedContent?.generated_feynman || "Geração em andamento..."}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="flashcards" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedContent?.generated_flashcards?.map((card: any, idx: number) => (
                      <Card key={idx} className="bg-background/50">
                        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 border-b border-primary/5">
                          <Badge variant="outline" className="text-[10px]">Flashcard {idx + 1}</Badge>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Check className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-3 w-3" /></Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <p className="text-sm font-bold">{card.front || card.pergunta}</p>
                          <Separator className="bg-primary/5" />
                          <p className="text-sm text-muted-foreground italic">{card.back || card.resposta}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="pedagogical" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-base font-bold">Qualidade Geral</Label>
                        <Select value={reviewLabel} onValueChange={setReviewLabel}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o selo de qualidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Excelente">Excelente (Pronto para Aluno)</SelectItem>
                            <SelectItem value="Bom">Bom (Ajustes Mínimos)</SelectItem>
                            <SelectItem value="Revisar">Revisar (Necessita Correção)</SelectItem>
                            <SelectItem value="Reprovado">Reprovado (Descartar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Precisão Médica (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewPrecision} onChange={e => setReviewPrecision(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Didática (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewDidactic} onChange={e => setReviewDidactic(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Clareza (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewClarity} onChange={e => setReviewClarity(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Profundidade (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewDepth} onChange={e => setReviewDepth(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Flashcards (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewFlashcards} onChange={e => setReviewFlashcards(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Quiz (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewQuiz} onChange={e => setReviewQuiz(Number(e.target.value))} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Risco de Alucinação</Label>
                        <Select value={reviewHallucination} onValueChange={setReviewHallucination}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="low">Baixo</SelectItem>
                            <SelectItem value="medium">Médio</SelectItem>
                            <SelectItem value="high">Alto (Crítico)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Tipo de Revisão</Label>
                          <Select value={reviewType} onValueChange={setReviewType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pedagogical">Pedagógica (Professor)</SelectItem>
                              <SelectItem value="scientific">Científica (Médico Especialista)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Aderência à Diretriz (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewAdherence} onChange={e => setReviewAdherence(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Segurança Clínica (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewSafety} onChange={e => setReviewSafety(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Utilidade para Prova (0-10)</Label>
                          <Input type="number" min="0" max="10" value={reviewExamUtility} onChange={e => setReviewExamUtility(Number(e.target.value))} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label>Comentários de Auditoria</Label>
                        <Textarea 
                          placeholder="Descreva pontos de melhoria ou erros encontrados..." 
                          className="min-h-[150px]"
                          value={reviewComments}
                          onChange={e => setReviewComments(e.target.value)}
                        />
                        <Button 
                          className="w-full gap-2 h-12 text-lg shadow-glow-sm" 
                          variant="default"
                          disabled={submitReview.isPending}
                          onClick={() => {
                            submitReview.mutate({
                              contentId: selectedContent.id,
                              score: Math.round((reviewPrecision + reviewSafety + reviewAdherence + reviewDidactic) / 4),
                              label: reviewLabel,
                              precision: reviewPrecision,
                              clarity: reviewClarity,
                              depth: reviewDepth,
                              flashcards: reviewFlashcards,
                              quiz: reviewQuiz,
                              feynman: reviewFeynman,
                              didactic: reviewDidactic,
                              adherence: reviewAdherence,
                              safety: reviewSafety,
                              examUtility: reviewExamUtility,
                              reviewType: reviewType,
                              hallucination: reviewHallucination,
                              comments: reviewComments
                            });
                          }}
                        >
                          {submitReview.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                          Finalizar Auditoria Médica
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="multimedia" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-primary/10">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Music className="h-4 w-4 text-blue-500" />
                          Vínculo de Áudio (NotebookLM)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">URL do Áudio Deep Dive</Label>
                          <Input 
                            placeholder="https://..." 
                            defaultValue={selectedContent?.notebooklm_audio_url}
                            onBlur={(e) => updateMultimedia.mutate({ contentId: selectedContent.id, audioUrl: e.target.value })}
                          />
                        </div>
                        {selectedContent?.notebooklm_audio_url && (
                          <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20">
                            <audio controls className="w-full h-8">
                              <source src={selectedContent.notebooklm_audio_url} type="audio/mpeg" />
                            </audio>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-primary/10">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Video className="h-4 w-4 text-purple-500" />
                          Vínculo de Vídeo Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">URL do Vídeo Overview</Label>
                          <Input 
                            placeholder="https://..." 
                            defaultValue={selectedContent?.notebooklm_video_url}
                            onBlur={(e) => updateMultimedia.mutate({ contentId: selectedContent.id, videoUrl: e.target.value })}
                          />
                        </div>
                        {selectedContent?.notebooklm_video_url && (
                          <div className="aspect-video rounded bg-black flex items-center justify-center">
                            <Video className="h-8 w-8 text-white/20" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-muted/30 border-dashed">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-bold uppercase">Status Multimídia</p>
                          <p className="text-[10px] text-muted-foreground">{selectedContent?.media_status}</p>
                        </div>
                      </div>
                      <Badge variant={selectedContent?.media_status === 'ready_for_students' ? 'default' : 'outline'}>
                        {selectedContent?.media_status === 'ready_for_students' ? 'Liberado para Alunos' : 'Em Produção'}
                      </Badge>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notebooklm" className="mt-0 space-y-6">
                  <div className="p-6 rounded-xl border-2 border-dashed border-indigo-500/20 bg-indigo-500/5 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                        <Music className="h-5 w-5 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-indigo-500">Integração NotebookLM Pro</h4>
                        <p className="text-xs text-muted-foreground">
                          Siga o fluxo abaixo para gerar Deep Dive Audio (Podcasts) e Overview Videos.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-bold">1</span>
                          <p className="text-xs font-medium">Exportar pacote ENAZIZI</p>
                        </div>
                        <Button 
                          className="w-full bg-indigo-500 hover:bg-indigo-600 gap-2"
                          onClick={() => handleCopyNotebookLM(selectedContent)}
                        >
                          <Copy className="h-4 w-4" /> Copiar Pacote para NotebookLM
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-500 text-[10px] font-bold">2</span>
                          <p className="text-xs font-medium">Vincular links gerados</p>
                        </div>
                        <div className="space-y-2">
                          <Input placeholder="Link do Deep Dive Audio" className="h-8 text-[11px]" />
                          <Input placeholder="Link do Guia de Estudo" className="h-8 text-[11px]" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-indigo-500/10 flex justify-between items-center">
                       <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                         <ExternalLink className="h-3 w-3" /> Requer assinatura NotebookLM Pro / Enterprise
                       </p>
                       <Button variant="link" className="text-indigo-500 text-xs h-auto p-0">Ver tutorial de integração</Button>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-primary/10 flex items-center justify-between">
                       <p className="text-[10px] text-muted-foreground italic uppercase tracking-widest">ENAZIZI - Central de Produção IA</p>
                       <p className="text-[10px] text-muted-foreground">Certified v1.0</p>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AIStudioWrapper() {
  return (
    <div className="relative min-h-screen bg-background p-6 sm:p-10 space-y-10">
      <EnaflixBackgroundFX intensity="medium" />
      <AIStudio />
    </div>
  );
}

export default AIStudioWrapper;
