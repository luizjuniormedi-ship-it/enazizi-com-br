import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSearch, FlaskConical, Image as ImageIcon } from "lucide-react";

interface ExamEntry {
  type: "lab" | "imaging";
  content: string;
  timestamp: number;
}

interface ExamsPanelProps {
  exams: ExamEntry[];
}

const ExamsPanel = ({ exams }: ExamsPanelProps) => {
  const labExams = exams.filter((e) => e.type === "lab");
  const imagingExams = exams.filter((e) => e.type === "imaging");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Exames</span>
        </div>
        {exams.length > 0 && (
          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">{exams.length}</Badge>
        )}
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-6 rounded-xl border border-dashed border-border/30">
          <FileSearch className="h-6 w-6 mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-[11px] text-muted-foreground/50">Nenhum exame solicitado</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {labExams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                  <FlaskConical className="h-3 w-3 text-blue-400" /> Laboratoriais
                </p>
                {labExams.map((exam, i) => (
                  <div key={i} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 mb-1.5">
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono">{exam.content}</p>
                  </div>
                ))}
              </div>
            )}

            {imagingExams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                  <ImageIcon className="h-3 w-3 text-purple-400" /> Imagem
                </p>
                {imagingExams.map((exam, i) => (
                  <div key={i} className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 mb-1.5">
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{exam.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default ExamsPanel;
