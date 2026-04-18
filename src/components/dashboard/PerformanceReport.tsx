import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// jsPDF carregado sob demanda (lazy) para reduzir bundle inicial

const PerformanceReport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      const [profileRes, perfRes, errorsRes, domainRes, examsRes, diagRes] = await Promise.all([
        supabase.from("profiles").select("display_name, faculdade, periodo, target_specialty").eq("user_id", user.id).maybeSingle(),
        supabase.from("study_performance").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("error_bank").select("tema, subtema, tipo_questao, categoria_erro, vezes_errado").eq("user_id", user.id).order("vezes_errado", { ascending: false }).limit(50),
        supabase.from("medical_domain_map").select("specialty, domain_score, questions_answered, correct_answers, errors_count").eq("user_id", user.id).order("domain_score", { ascending: false }),
        supabase.from("exam_sessions").select("title, score, total_questions, finished_at").eq("user_id", user.id).eq("status", "finished").order("finished_at", { ascending: false }).limit(20),
        supabase.from("diagnostic_results").select("score, total_questions, completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(1),
      ]);

      const profile = profileRes.data;
      const perf = perfRes.data;
      const errors = errorsRes.data || [];
      const domains = domainRes.data || [];
      const exams = examsRes.data || [];
      const diag = diagRes.data?.[0];

      // No data guard — show message instead of empty PDF
      if (!perf && errors.length === 0 && domains.length === 0 && exams.length === 0 && !diag) {
        toast({ title: "Sem dados para exportar", description: "Estude um pouco primeiro para gerar seu relatório!", variant: "destructive" });
        return;
      }

      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const M = 15;
      const U = W - M * 2;
      let y = 20;

      const addPage = () => { doc.addPage(); y = 20; };
      const checkPage = (needed: number) => { if (y + needed > 275) addPage(); };

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Desempenho", M, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`ENAZIZI — ${new Date().toLocaleDateString("pt-BR")}`, M, y);
      y += 10;
      doc.setTextColor(0);

      // Profile
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Dados do Aluno", M, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const profileLines = [
        `Nome: ${profile?.display_name || user.email}`,
        profile?.faculdade ? `Faculdade: ${profile.faculdade}` : null,
        profile?.periodo ? `Período: ${profile.periodo}º` : null,
        profile?.target_specialty ? `Especialidade alvo: ${profile.target_specialty}` : null,
      ].filter(Boolean) as string[];
      profileLines.forEach((l) => { doc.text(l, M, y); y += 5; });
      y += 5;

      // Performance summary
      if (perf) {
        checkPage(30);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo de Performance", M, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Questões respondidas: ${perf.questoes_respondidas}`, M, y); y += 5;
        doc.text(`Taxa de acerto: ${(perf.taxa_acerto * 100).toFixed(1)}%`, M, y); y += 5;
        if (perf.pontuacao_discursiva) {
          doc.text(`Pontuação discursiva: ${perf.pontuacao_discursiva}/10`, M, y); y += 5;
        }
        y += 5;
      }

      // Diagnostic
      if (diag) {
        checkPage(20);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Diagnóstico Inicial", M, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Score: ${diag.score}/${diag.total_questions} (${Math.round((diag.score / diag.total_questions) * 100)}%)`, M, y); y += 5;
        doc.text(`Data: ${new Date(diag.completed_at).toLocaleDateString("pt-BR")}`, M, y); y += 8;
      }

      // Domain map
      if (domains.length > 0) {
        checkPage(15 + domains.length * 5);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Maestria por Especialidade", M, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        // Table header
        doc.setFont("helvetica", "bold");
        doc.text("Especialidade", M, y);
        doc.text("Score", M + 75, y);
        doc.text("Questões", M + 100, y);
        doc.text("Acerto", M + 125, y);
        doc.text("Erros", M + 150, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setDrawColor(200);
        doc.line(M, y - 2, M + U, y - 2);

        domains.forEach((d) => {
          checkPage(6);
          const rate = d.questions_answered > 0 ? Math.round((d.correct_answers / d.questions_answered) * 100) : 0;
          doc.text(d.specialty.slice(0, 30), M, y);
          doc.text(`${Math.round(d.domain_score)}%`, M + 75, y);
          doc.text(`${d.questions_answered}`, M + 100, y);
          doc.text(`${rate}%`, M + 125, y);
          doc.text(`${d.errors_count}`, M + 150, y);
          y += 5;
        });
        y += 5;
      }

      // Exams
      if (exams.length > 0) {
        checkPage(15 + exams.length * 5);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Histórico de Simulados", M, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        exams.forEach((e) => {
          checkPage(6);
          const date = e.finished_at ? new Date(e.finished_at).toLocaleDateString("pt-BR") : "-";
          doc.text(`${e.title} — ${Math.round(e.score || 0)}% (${date})`, M, y);
          y += 5;
        });
        y += 5;
      }

      // Errors
      if (errors.length > 0) {
        checkPage(15 + Math.min(errors.length, 20) * 5);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Principais Erros", M, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        // Group by theme
        const themeMap: Record<string, number> = {};
        errors.forEach((e) => { themeMap[e.tema] = (themeMap[e.tema] || 0) + e.vezes_errado; });
        const sorted = Object.entries(themeMap).sort((a, b) => b[1] - a[1]);

        sorted.slice(0, 15).forEach(([tema, count]) => {
          checkPage(6);
          doc.text(`• ${tema}: ${count}x errado`, M, y);
          y += 5;
        });
        y += 5;
      }

      // Weak topics
      if (perf?.temas_fracos && Array.isArray(perf.temas_fracos) && (perf.temas_fracos as string[]).length > 0) {
        checkPage(15);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Temas que Precisam de Atenção", M, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        (perf.temas_fracos as string[]).slice(0, 10).forEach((t: string) => {
          checkPage(6);
          doc.text(`• ${t}`, M, y);
          y += 5;
        });
      }

      // Footer
      checkPage(15);
      y += 10;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Gerado automaticamente pela plataforma ENAZIZI. Dados sujeitos a atualização.", M, y);

      const name = (profile?.display_name || "aluno").replace(/\s+/g, "_");
      doc.save(`Relatorio_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF gerado!", description: "Relatório de desempenho exportado com sucesso." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao gerar relatório.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-1.5">
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {generating ? "Gerando..." : "Exportar PDF"}
    </Button>
  );
};

export default PerformanceReport;
