import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Eye, ChevronLeft, ChevronRight, Loader2, Filter, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReviewQuestion {
  id: string;
  statement: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  topic: string;
  subtopic: string | null;
  source: string;
  review_status: string;
  quality_tier: string;
  source_type: string | null;
  permission_type: string | null;
  created_at: string;
}

const QUALITY_COLORS: Record<string, string> = {
  exam_standard: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  basic: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  needs_upgrade: "bg-red-500/10 text-red-700 border-red-500/30",
};

const QUALITY_LABELS: Record<string, string> = {
  exam_standard: "Padrão Prova",
  basic: "Básica",
  needs_upgrade: "Precisa Enriquecer",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendentes",
  approved: "Aprovadas",
  rejected: "Rejeitadas",
  needs_upgrade: "Enriquecer",
  needs_review: "Revisão",
};

const AdminQuestionReviewPanel = () => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const PAGE_SIZE = 20;

  const fetchCounts = async () => {
    const statuses = ["pending", "approved", "rejected", "needs_upgrade", "needs_review"];
    const results: Record<string, number> = {};
    const promises = statuses.map(async (status) => {
      const { count } = await supabase
        .from("questions_bank")
        .select("id", { count: "exact", head: true })
        .eq("review_status", status);
      if (count && count > 0) results[status] = count;
    });
    await Promise.all(promises);
    setCounts(results);
  };

  const fetchQuestions = async () => {
    setLoading(true);
    let query = supabase.from("questions_bank")
      .select("id, statement, options, correct_index, explanation, topic, subtopic, source, review_status, quality_tier, source_type, permission_type, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== "all") {
      query = query.eq("review_status", statusFilter);
    } else {
      // P2 improvement: exclude REJECTED from 'all' view unless explicitly filtered
      query = query.neq("review_status", "rejected");
    }
    if (qualityFilter !== "all") {
      query = query.eq("quality_tier", qualityFilter);
    }
    if (sourceFilter.trim()) {
      query = query.ilike("source", `%${sourceFilter.trim()}%`);
    }

    const { data, count, error } = await query;
    if (!error && data) {
      setQuestions(data.map((q) => ({
        id: q.id,
        statement: q.statement,
        options: Array.isArray(q.options) ? q.options as string[] : [],
        correct_index: q.correct_index ?? 0,
        explanation: q.explanation,
        topic: q.topic || "",
        subtopic: q.subtopic,
        source: q.source || "",
        review_status: q.review_status || "pending",
        quality_tier: q.quality_tier || "basic",
        source_type: q.source_type,
        permission_type: q.permission_type,
        created_at: q.created_at,
      })));
      setTotal(count || 0);
    } else if (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchQuestions(); fetchCounts(); }, 250);
    return () => clearTimeout(t);
  }, [page, statusFilter, qualityFilter, sourceFilter]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setActionLoading(id);
    const { error } = await supabase.from("questions_bank")
      .update({ review_status: action })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: action === "approved" ? "Aprovada" : "Rejeitada" });
      setQuestions(prev => prev.filter(q => q.id !== id));
      setTotal(prev => prev - 1);
      fetchCounts();
    }
    setActionLoading(null);
  };

  const handleBulkApprove = async () => {
    setActionLoading("bulk");
    // Only approve questions that are NOT already approved
    const pendingQuestions = questions.filter(q => q.review_status !== "approved");
    if (pendingQuestions.length === 0) {
      toast({ title: "Nenhuma questão pendente para aprovar nesta página" });
      setActionLoading(null);
      return;
    }
    const ids = pendingQuestions.map(q => q.id);
    
    // Process in chunks of 50 to avoid URL length limits
    let approved = 0;
    let lastError: any = null;
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const { error } = await supabase.from("questions_bank")
        .update({ review_status: "approved" })
        .in("id", chunk);
      if (error) {
        lastError = error;
        console.error("Bulk approve error:", error);
      } else {
        approved += chunk.length;
      }
    }
    
    if (lastError) {
      toast({ title: "Erro parcial", description: lastError.message, variant: "destructive" });
    } else {
      toast({ title: `${approved} questões aprovadas com sucesso` });
    }
    fetchQuestions();
    fetchCounts();
    setActionLoading(null);
  };

  const handleApproveAllFiltered = async () => {
    if (!window.confirm(`Deseja aprovar TODAS as ${total} questões que correspondem aos filtros atuais?`)) {
      return;
    }

    setActionLoading("bulk-all");
    try {
      let query = supabase.from("questions_bank")
        .update({ review_status: "approved" })
        .neq("review_status", "approved");

      if (statusFilter !== "all") {
        query = query.eq("review_status", statusFilter);
      }
      if (qualityFilter !== "all") {
        query = query.eq("quality_tier", qualityFilter);
      }
      if (sourceFilter.trim()) {
        query = query.ilike("source", `%${sourceFilter.trim()}%`);
      }

      const { error, count } = await query;
      
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Lote completo aprovado com sucesso" });
      fetchQuestions();
      fetchCounts();
    } catch (error: any) {
      console.error("Bulk approve all error:", error);
      toast({ title: "Erro na aprovação em lote", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const needsUpgradeIds = questions
        .filter(q => q.quality_tier === "needs_upgrade" || q.statement.length < 400)
        .map(q => q.id)
        .slice(0, 10);

      if (needsUpgradeIds.length === 0) {
        toast({ title: "Nenhuma questão para enriquecer nesta página" });
        setUpgradeLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("upgrade-questions", {
        body: { ids: needsUpgradeIds, batch_size: 10 },
      });

      if (error) throw error;
      toast({ title: `${data?.upgraded || 0} questões enriquecidas` });
      fetchQuestions();
      fetchCounts();
    } catch (e: any) {
      toast({ title: "Erro ao enriquecer", description: e.message, variant: "destructive" });
    }
    setUpgradeLoading(false);
  };

  const isActionableStatus = statusFilter === "all" || statusFilter === "pending" || statusFilter === "needs_upgrade" || statusFilter === "needs_review";

  return (
    <div className="glass-card p-4 sm:p-5 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 flex-shrink-0">
            <Eye className="h-5 w-5 text-amber-500" />
          </div>
          <h2 className="text-sm sm:text-base font-semibold">Revisão de Questões</h2>
          <Badge variant="secondary" className="text-xs">{total}</Badge>
        </div>
      </div>

      {/* Status summary badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(counts).map(([status, count]) => (
          <Badge
            key={status}
            variant="outline"
            className={`text-[10px] cursor-pointer ${statusFilter === status ? 'ring-1 ring-primary' : ''}`}
            onClick={() => { setStatusFilter(statusFilter === status ? "all" : status); setPage(0); }}
          >
            {STATUS_LABELS[status] || status}: {count}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="h-7 text-xs w-28">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
            <SelectItem value="needs_upgrade">Enriquecer</SelectItem>
            <SelectItem value="needs_review">Revisão</SelectItem>
          </SelectContent>
        </Select>
        <Select value={qualityFilter} onValueChange={v => { setQualityFilter(v); setPage(0); }}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualidade: Todas</SelectItem>
            <SelectItem value="exam_standard">Padrão Prova</SelectItem>
            <SelectItem value="basic">Básica</SelectItem>
            <SelectItem value="needs_upgrade">Precisa Enriquecer</SelectItem>
          </SelectContent>
        </Select>
        {isActionableStatus && questions.length > 0 && (
          <Button size="sm" variant="outline" className="text-xs h-7"
            disabled={actionLoading === "bulk"} onClick={handleBulkApprove}>
            {actionLoading === "bulk" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aprovar Todas"}
          </Button>
        )}
        {isActionableStatus && total > PAGE_SIZE && (
          <Button size="sm" variant="outline" className="text-xs h-7 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
            disabled={actionLoading === "bulk-all"} onClick={handleApproveAllFiltered}>
            {actionLoading === "bulk-all" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Aprovar Lote ({total})
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-xs h-7 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
          disabled={upgradeLoading} onClick={handleUpgrade}>
          {upgradeLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Enriquecer
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : questions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma questão encontrada com os filtros selecionados.</p>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="p-2.5 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                  <p className="text-xs font-medium line-clamp-2">{q.statement.slice(0, 200)}...</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] h-4">{q.topic || "—"}</Badge>
                    {q.subtopic && <Badge variant="outline" className="text-[10px] h-4 border-primary/30 text-primary">{q.subtopic}</Badge>}
                    <Badge variant="outline" className="text-[10px] h-4">{q.source || "—"}</Badge>
                    <Badge variant="outline" className={`text-[10px] h-4 ${QUALITY_COLORS[q.quality_tier] || ""}`}>
                      {QUALITY_LABELS[q.quality_tier] || q.quality_tier}
                    </Badge>
                    {q.source_type && <Badge variant="outline" className="text-[10px] h-4">{q.source_type}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{q.statement.length} chars</span>
                    <span className="text-[10px] text-muted-foreground">{q.options.length} alt</span>
                  </div>
                </div>
                {(isActionableStatus || statusFilter === "all") && q.review_status !== "approved" && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600"
                      disabled={!!actionLoading} onClick={() => handleAction(q.id, "approved")}>
                      {actionLoading === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      disabled={!!actionLoading} onClick={() => handleAction(q.id, "rejected")}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {expanded === q.id && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                  {/* Full statement */}
                  <div className="bg-muted/30 rounded p-2">
                    <p className="text-xs font-medium mb-1 text-muted-foreground">Enunciado ({q.statement.length} caracteres)</p>
                    <p className="text-xs leading-relaxed">{q.statement}</p>
                  </div>

                  {/* Options */}
                  {q.options.map((opt, i) => (
                    <div key={i} className={`text-xs px-2 py-1 rounded ${i === q.correct_index ? "bg-emerald-500/10 text-emerald-700 font-medium" : "text-muted-foreground"}`}>
                      {String.fromCharCode(65 + i)}) {typeof opt === "string" ? opt : JSON.stringify(opt)}
                    </div>
                  ))}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="bg-blue-500/5 rounded p-2">
                      <p className="text-xs font-medium mb-1 text-blue-600">Explicação</p>
                      <p className="text-xs leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3 mr-1" />Anterior
            </Button>
            <span className="text-[10px] text-muted-foreground">{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
              Próxima<ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestionReviewPanel;
