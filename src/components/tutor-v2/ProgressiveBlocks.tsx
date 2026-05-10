import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProgressiveBlocksProps {
  content: string;
}

/**
 * Splits a Tutor V2 response by "## " headings (typical of the 15-block protocol)
 * and reveals one block at a time. Falls back to rendering the full content
 * when no block headings are detected.
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

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/70">
          Bloco {revealed} de {blocks.length}
        </span>
        {hasMore ? (
          <Button
            size="sm"
            onClick={() => setRevealed((n) => Math.min(blocks.length, n + 1))}
            className="h-8 px-4 text-[10px] font-black uppercase tracking-tighter gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30"
          >
            Próximo bloco <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
            <Check className="h-3 w-3" /> Aula completa
          </span>
        )}
      </div>
    </div>
  );
}

function splitBlocks(content: string): string[] {
  if (!content) return [];
  // Split on lines starting with "## " (markdown H2). Keep the heading attached
  // to its block. If only one segment results, return the whole content.
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
