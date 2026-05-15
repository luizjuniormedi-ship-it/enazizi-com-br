import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { 
  ChevronRight, 
  Check, 
  HelpCircle, 
  Activity, 
  Stethoscope, 
  AlertTriangle, 
  ShieldAlert,
  ChevronDown,
  Brain,
  Lightbulb,
  Microscope,
  GitBranch,
  Target,
  Zap,
  BookOpen,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProgressiveBlocksProps {
  content: string;
}

const BLOCK_ICONS: Record<string, any> = {
  "Missão Clínica": Target,
  "Missão da sessão": Target,
  "Explicação Feynman": Lightbulb,
  "Explicação leiga": Lightbulb,
  "Lay/Feynman": Lightbulb,
  "Definição Técnica": Info,
  "Explicação técnica": Info,
  "Técnica": Info,
  "Fisiopatologia": Microscope,
  "Fisiopato": Microscope,
  "Mecanismo molecular": Microscope,
  "Raciocínio clínico": Brain,
  "Integração Clínica": Activity,
  "Integração prática": Activity,
  "Aplicação Clínica": Activity,
  "Aplicação": Activity,
  "Diagnóstico Diferencial": GitBranch,
  "Diferencial": GitBranch,
  "Conduta": Zap,
  "Pegadinhas": AlertTriangle,
  "Pegadinhas de prova": AlertTriangle,
  "Erros de Preceptoria": ShieldAlert,
  "Preceptoria": ShieldAlert,
  "Active Recall": Brain,
  "Recall": Brain,
  "Mini teste": BookOpen,
  "Questão Comentada": BookOpen,
  "Resumo Final": Check,
  "Resumo": Check,
  "Próximo passo": ChevronRight,
  "Referências": BookOpen,
};


export default function ProgressiveBlocks({ content }: ProgressiveBlocksProps) {
  const parsedContent = useMemo(() => parseContent(content), [content]);
  const [revealed, setRevealed] = useState(1);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<number, boolean>>({ 0: true });

  const toggleBlock = (idx: number) => {
    setExpandedBlocks(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (parsedContent.length <= 1 && typeof parsedContent[0] === 'string') {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  const visible = parsedContent.slice(0, revealed);
  const hasMore = revealed < parsedContent.length;
  
  const lastVisible = visible[visible.length - 1];
  const currentTitle = typeof lastVisible === 'string' ? extractTitle(lastVisible) : "este quadro clínico";

  const focusInput = () => {
    const el = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder^="Pergunte ao Tutor"]'
    );
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {visible.map((item, idx) => {
          const isString = typeof item === 'string';
          const title = isString ? extractTitle(item) : "Quadro Estruturado";
          const Icon = BLOCK_ICONS[title] || (isString ? Stethoscope : Activity);
          const isExpanded = expandedBlocks[idx] ?? true;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "rounded-[2rem] border transition-all duration-300 overflow-hidden",
                isExpanded ? "bg-slate-900/40 border-white/10 shadow-xl" : "bg-slate-900/20 border-white/5"
              )}
            >
              {/* Header colapsável */}
              <button 
                onClick={() => toggleBlock(idx)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center transition-all",
                    isExpanded ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={cn(
                    "text-[11px] font-black uppercase tracking-[0.2em]",
                    isExpanded ? "text-white" : "text-slate-500"
                  )}>
                    {title}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-slate-600 transition-transform duration-300",
                  isExpanded ? "rotate-180" : "rotate-0"
                )} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="p-6 pt-0 border-t border-white/5 mt-0.5">
                      {isString ? (
                        <div className="prose prose-invert prose-sm max-w-none pt-4">
                          <ReactMarkdown>{item.replace(/^#+\s+.*(\r?\n)?/, '')}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="pt-4">
                          <StructuredBoard data={item} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {hasMore ? (
        <motion.div
          key={`checkpoint-${revealed}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/20 ring-1 ring-white/5 shadow-2xl backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                Checkpoint Cognitivo • {revealed}/{parsedContent.length}
              </span>
            </div>
          </div>
          <p className="text-[14px] text-slate-200 leading-relaxed mb-5">
            Deseja aprofundar em <strong className="text-indigo-300 font-bold">{currentTitle}</strong> ou podemos prosseguir com o raciocínio clínico?
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={focusInput}
              className="h-10 px-4 text-[11px] font-black uppercase tracking-widest gap-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-2xl"
            >
              <HelpCircle className="h-4 w-4" /> Tenho uma dúvida
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setRevealed((n) => Math.min(parsedContent.length, n + 1));
                setExpandedBlocks(prev => ({ ...prev, [revealed]: true }));
              }}
              className="h-10 px-5 text-[11px] font-black uppercase tracking-widest gap-2 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Avançar <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/50">
            Fim da Transmissão Cognitiva
          </span>
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
            <Check className="h-3 w-3" /> Aula Completa
          </span>
        </div>
      )}
    </div>
  );
}

function StructuredBoard({ data }: { data: any }) {
  if (data.type === 'clinical_flow') {
    return (
      <div className="space-y-4">
        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2">
          <Stethoscope className="h-4 w-4" /> {data.payload.title || "Fluxograma Clínico"}
        </h4>
        <div className="space-y-4">
          {data.payload.nodes.map((node: any, idx: number) => (
            <div key={node.id} className="flex flex-col items-center">
              <div className={cn(
                "p-4 rounded-2xl border w-full max-w-md transition-all",
                node.kind === 'decision' ? "bg-amber-500/10 border-amber-500/30 text-amber-200" :
                node.kind === 'action' ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200" :
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
              )}>
                <p className="text-[13px] font-bold text-center leading-snug">{node.label}</p>
                {node.kind === 'decision' && <p className="text-[9px] uppercase tracking-widest text-amber-500/70 font-black mt-2 text-center">Decisão Clínica</p>}
              </div>
              {idx < data.payload.nodes.length - 1 && (
                <div className="h-6 w-0.5 bg-gradient-to-b from-slate-700 to-transparent my-1" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'differential_diagnosis') {
    return (
      <div>
        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {data.payload.title || "Diagnóstico Diferencial"}
        </h4>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Queixa: {data.payload.chief_complaint}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.payload.items.map((item: any) => (
            <div key={item.name} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-black text-white">{item.name}</span>
                <span className={cn(
                  "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                  item.severity === 'critica' ? "bg-red-500/20 text-red-400" : "bg-indigo-500/20 text-indigo-400"
                )}>
                  {item.probability ? `${Math.round(item.probability * 100)}%` : item.severity}
                </span>
              </div>
              <div className="space-y-2">
                {item.pros?.slice(0, 2).map((pro: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="h-1 w-1 rounded-full bg-emerald-500 mt-1.5" />
                    <p className="text-[11px] text-slate-400 leading-tight">{pro}</p>
                  </div>
                ))}
              </div>
              {item.doNotMiss && (
                <div className="mt-3 flex items-center gap-1.5 text-rose-500">
                  <ShieldAlert className="h-3 w-3" />
                  <span className="text-[8px] font-black uppercase tracking-tighter">Do Not Miss</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <pre className="text-[10px] text-slate-500">{JSON.stringify(data, null, 2)}</pre>;
}

function parseContent(content: string): (string | any)[] {
  if (!content) return [];
  
  const result: (string | any)[] = [];
  
  const jsonRegex = /\{[\s\n]*"type":[\s\n]*"(clinical_flow|differential_diagnosis|pharmacology_compare)"[\s\S]*?\}/g;
  
  let match;
  let lastIdx = 0;
  
  while ((match = jsonRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIdx, match.index).trim();
    if (textBefore) {
      result.push(...splitTextIntoBlocks(textBefore));
    }
    
    try {
      result.push(JSON.parse(match[0]));
    } catch (e) {
      result.push(match[0]);
    }
    
    lastIdx = match.index + match[0].length;
  }
  
  const textAfter = content.slice(lastIdx).trim();
  if (textAfter) {
    result.push(...splitTextIntoBlocks(textAfter));
  }
  
  return result;
}

function splitTextIntoBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      const t = current.join("\n").trim();
      if (t) blocks.push(t);
      current = [];
    }
  };

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flush();
    }
    current.push(line);
  }
  flush();

  return blocks;
}

function extractTitle(block: string): string {
  if (!block) return "este bloco";
  const firstLine = block.split(/\r?\n/)[0] || "";
  const cleaned = firstLine
    .replace(/^#+\s*/, "")
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "")
    .replace(/^BLOCO\s+\d+\s*[—-]\s*/i, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/\s*\(.*\)\s*/, "") // Remove parênteses
    .trim();
  return cleaned || "este bloco";
}
