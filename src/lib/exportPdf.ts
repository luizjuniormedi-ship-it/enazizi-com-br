// jsPDF carregado sob demanda (lazy) — não entra no bundle inicial
// Reduz ~390 KB do chunk principal das páginas que importam este módulo

interface ExportItem {
  title: string;
  content: string;
  subtitle?: string;
}

export async function exportToPdf(items: ExportItem[], docTitle: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usable = pageW - margin * 2;
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(docTitle, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Exportado em ${new Date().toLocaleDateString("pt-BR")} — ENAZIZI`, margin, y);
  doc.setTextColor(0);
  y += 10;

  items.forEach((item, idx) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Item title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${item.title}`, usable);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 5 + 2;

    if (item.subtitle) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      doc.text(item.subtitle, margin, y);
      doc.setTextColor(0);
      y += 5;
    }

    // Item content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const contentLines = doc.splitTextToSize(item.content, usable);
    contentLines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 4.5;
    });

    y += 6;
  });

  doc.save(`${docTitle.replace(/\s+/g, "_")}.pdf`);
}

interface BIReportData {
  kpis: Record<string, any>;
  topicBreakdown?: { topic: string; accuracy: number; total: number }[];
  deficientTopics?: { topic: string; accuracy: number; total: number }[];
  masteredTopics?: { topic: string; accuracy: number; total: number }[];
  atRiskStudents?: { display_name: string; reasons: string[]; criticality: string }[];
  studentEngagement?: { display_name: string; xp: number; streak: number; accuracy: number }[];
  studentPercentile?: { display_name: string; percentile: number; accuracy: number };
}

export async function exportProfessorBIReport(data: BIReportData, title: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const usable = pageW - margin * 2;
  let y = 20;

  const checkPage = (needed = 20) => {
    if (y > 280 - needed) { doc.addPage(); y = 20; }
  };

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — ENAZIZI`, margin, y);
  doc.setTextColor(0);
  y += 10;

  // KPIs
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores (KPIs)", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  Object.entries(data.kpis).forEach(([key, val]) => {
    checkPage();
    doc.text(`• ${key}: ${val}`, margin + 2, y);
    y += 5;
  });
  y += 4;

  // At-risk students
  if (data.atRiskStudents?.length) {
    checkPage(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Alunos em Risco", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    data.atRiskStudents.forEach(s => {
      checkPage(10);
      doc.text(`⚠ ${s.display_name} [${s.criticality}]: ${s.reasons.join("; ")}`, margin + 2, y);
      y += 5;
    });
    y += 4;
  }

  // Topic breakdown
  if (data.topicBreakdown?.length) {
    checkPage(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Desempenho por Topico", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    data.topicBreakdown.slice(0, 20).forEach(t => {
      checkPage();
      doc.text(`${t.topic}: ${t.accuracy}% (${t.total} questoes)`, margin + 2, y);
      y += 4.5;
    });
    y += 4;
  }

  // Student engagement
  if (data.studentEngagement?.length) {
    checkPage(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Engajamento dos Alunos", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    data.studentEngagement.slice(0, 30).forEach(s => {
      checkPage();
      doc.text(`${s.display_name}: XP ${s.xp} | Streak ${s.streak}d | Acuracia ${s.accuracy}%`, margin + 2, y);
      y += 4.5;
    });
  }

  // Percentile
  if (data.studentPercentile) {
    checkPage(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Comparativo Individual", margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.studentPercentile.display_name} esta no percentil ${data.studentPercentile.percentile} da turma (acuracia ${data.studentPercentile.accuracy}%)`, margin + 2, y);
  }

  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}
