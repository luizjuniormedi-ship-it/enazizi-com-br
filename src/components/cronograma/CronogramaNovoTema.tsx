import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Save, AlertTriangle, Paperclip, X, Zap } from "lucide-react";

interface Props {
  specialties: string[];
  onAdd: (
    tema: string, especialidade: string, subtopico: string, dataEstudo: string,
    fonte: string, dificuldade: string, observacoes: string,
    questoesFeitas: number, questoesErradas: number,
    files?: File[]
  ) => void;
}

const FONTES = [
  { value: "literatura", label: "📚 Literatura médica" },
  { value: "material", label: "📄 Material enviado" },
  { value: "aula", label: "🎓 Aula / Curso" },
  { value: "questoes", label: "📝 Banco de Questões" },
  { value: "simulado", label: "🧪 Simulado externo" },
  { value: "revisao", label: "🔁 Revisão" },
];

const DIFICULDADES = [
  { value: "facil", label: "🟢 Fácil" },
  { value: "medio", label: "🟡 Médio" },
  { value: "dificil", label: "🔴 Difícil" },
];

const CronogramaNovoTema = ({ specialties, onAdd }: Props) => {
  const [tema, setTema] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [subtopico, setSubtopico] = useState("");
  const [dataEstudo, setDataEstudo] = useState(new Date().toISOString().split("T")[0]);
  const [fonte, setFonte] = useState("literatura");
  const [dificuldade, setDificuldade] = useState("medio");
  const [observacoes, setObservacoes] = useState("");
  const [questoesFeitas, setQuestoesFeitas] = useState("");
  const [questoesErradas, setQuestoesErradas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const feitas = parseInt(questoesFeitas) || 0;
  const erradas = parseInt(questoesErradas) || 0;
  const acertos = feitas - erradas;
  const taxaErro = feitas > 0 ? Math.round((erradas / feitas) * 100) : 0;

  const getSchedulePreview = () => {
    if (taxaErro > 60) return { text: "Cronograma AGRESSIVO: D1, D2, D4, D7, D15, D30", color: "text-destructive" };
    if (taxaErro > 40) return { text: "Reforçado: D1, D2, D3, D5, D7, D15, D30", color: "text-orange-500" };
    if (taxaErro > 20) return { text: "Extra: D1, D3, D5, D7, D15, D30", color: "text-amber-500" };
    return { text: "Padrão: D1, D3, D7, D15, D30", color: "text-emerald-500" };
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSimulatePDF = () => {
    const blob = new Blob(["%PDF-1.4\n1 0 obj\n<< /Title (Test PDF) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"], { type: "application/pdf" });
    const file = new File([blob], "teste_simulado.pdf", { type: "application/pdf" });
    setFiles(prev => [...prev, file]);
    if (!tema) setTema("Teste de Upload Real");
    if (!especialidade && specialties.length > 0) setEspecialidade(specialties[0]);
  };

  const handleSubmit = () => {
    if (!tema.trim() || !especialidade) return;
    onAdd(tema.trim(), especialidade, subtopico.trim(), dataEstudo, fonte, dificuldade, observacoes.trim(), feitas, erradas, files.length > 0 ? files : undefined);
    setTema(""); setSubtopico(""); setObservacoes(""); setQuestoesFeitas(""); setQuestoesErradas(""); setFiles([]);
  };

  const preview = getSchedulePreview();

  return (
    <div className="glass-card p-6 max-w-2xl">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        Registrar Novo Tema
      </h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Assunto / Tema *</label>
          <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex: Insuficiência Cardíaca Descompensada" autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Especialidade *</label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Subtópico (opcional)</label>
            <Input value={subtopico} onChange={(e) => setSubtopico(e.target.value)} placeholder="Ex: IC com FE reduzida" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Data do estudo (D0)</label>
            <Input type="date" value={dataEstudo} onChange={(e) => setDataEstudo(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Fonte</label>
            <Select value={fonte} onValueChange={setFonte}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Dificuldade percebida</label>
            <Select value={dificuldade} onValueChange={setDificuldade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFICULDADES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Questions section */}
        <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
          <h4 className="text-sm font-semibold">📝 Desempenho em Questões (opcional)</h4>
          <p className="text-xs text-muted-foreground">Registre para gerar cronograma adaptado ao erro. Entrada manual ou importação de simulados.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Questões realizadas</label>
              <Input type="number" min="0" value={questoesFeitas} onChange={(e) => setQuestoesFeitas(e.target.value)} placeholder="Ex: 20" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Questões erradas</label>
              <Input type="number" min="0" max={questoesFeitas} value={questoesErradas} onChange={(e) => setQuestoesErradas(e.target.value)} placeholder="Ex: 8" />
            </div>
          </div>
          {feitas > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background p-2">
                  <div className="text-lg font-bold text-emerald-500">{acertos}</div>
                  <div className="text-[9px] text-muted-foreground">Acertos</div>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <div className="text-lg font-bold text-destructive">{erradas}</div>
                  <div className="text-[9px] text-muted-foreground">Erros</div>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <div className={`text-lg font-bold ${taxaErro > 40 ? "text-destructive" : taxaErro > 20 ? "text-amber-500" : "text-emerald-500"}`}>{taxaErro}%</div>
                  <div className="text-[9px] text-muted-foreground">Erro</div>
                </div>
              </div>
              <div className={`text-xs font-medium flex items-center gap-1 ${preview.color}`}>
                {taxaErro > 40 && <AlertTriangle className="h-3 w-3" />}
                {preview.text}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Observações</label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Pontos importantes, dúvidas..." rows={2} />
        </div>

        {/* File attachments */}
        <div className="space-y-2">
          <label className="text-sm font-medium mb-1 block">Anexos (opcional)</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={handleFileAdd}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-2" /> Anexar arquivos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleSimulatePDF}>
              <Zap className="h-4 w-4 mr-2" /> DEV: Simular PDF
            </Button>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                  📎 {f.name.length > 25 ? f.name.slice(0, 22) + "..." : f.name}
                  <button type="button" onClick={() => removeFile(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={!tema.trim() || !especialidade} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" /> Salvar e Gerar Cronograma Adaptativo
        </Button>
      </div>
    </div>
  );
};

export default CronogramaNovoTema;
