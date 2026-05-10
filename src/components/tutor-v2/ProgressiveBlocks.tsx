import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ChevronRight, Check, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressiveBlocksProps {
  content: string;
}

/**
 * Splits a Tutor V2 response by "## " headings (typical of the 15-block protocol)
 * and reveals one block at a time. Between blocks, asks the student if they want
 * to advance or have a doubt — only advances after explicit confirmation.
 */
export default function ProgressiveBlocks({ content }: ProgressiveBlocksProps) {
  const blocks = useMemo(() => splitBlocks(content), [content]);
  const [revealed, setRevealed] = useState(1);

  if (blocks.length <= 1) {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  const visible = blocks.slice(0, revealed);
  const hasMore = revealed < blocks.length;
  const currentTitle = extractTitle(blocks[revealed - 1]);

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
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {visible.map((block, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="prose prose-invert prose-sm max-w-none border-l-2 border-indigo-500/30 pl-4"
          >
            <ReactMarkdown>{block}</ReactMarkdown>
          </motion.div>
        ))}
      </AnimatePresence>

      {hasMore ? (
        <motion.div
          key={`checkpoint-${revealed}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 ring-1 ring-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/80">
              Checkpoint • Bloco {revealed} de {blocks.length}
            </span>
          </div>
          <p className="text-[13px] text-slate-200 leading-relaxed mb-3">
            Antes de seguir, ficou alguma <strong className="text-indigo-300">dúvida sobre {currentTitle}</strong>?
            Se quiser, me pergunte agora — ou avance para o próximo bloco.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={focusInput}
              className="h-8 px-3 text-[10px] font-black uppercase tracking-tighter gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Tenho dúvida
            </Button>
            <Button
              size="sm"
              onClick={() => setRevealed((n) => Math.min(blocks.length, n + 1))}
              className="h-8 px-4 text-[10px] font-black uppercase tracking-tighter gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30"
            >
              Avançar <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/70">
            Bloco {revealed} de {blocks.length}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
            <Check className="h-3 w-3" /> Aula completa
          </span>
        </div>
      )}
    </div>
  );
}

function splitBlocks(content: string): string[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) {
      const text = current.join("\n").trim();
      if (text) blocks.push(text);
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
    .trim();
  return cleaned || "este bloco";
}
