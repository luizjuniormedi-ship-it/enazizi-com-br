import { useCallback } from "react";
import {
  isTutorBlock,
  wrapMarkdownAsBlock,
  type TutorBlock,
  type TutorStructuredMessage,
} from "@/types/tutor";

/**
 * useTutorBlocks — Sprint 4
 *
 * Utilitários puros para normalizar respostas do Tutor IA em blocos
 * pedagógicos tipados. Mantém compatibilidade retroativa total:
 *  - markdown puro → encapsula em DeepDiveBlock
 *  - lista de blocos → valida shape mínimo via isTutorBlock
 *  - blocos inválidos → ignorados silenciosamente
 *
 * Não faz I/O, não toca em estado React global. Pode ser usado
 * tanto pelo stream quanto por qualquer renderer.
 */

/** Reconstrói o markdown "concatenado" para campos legados (content). */
export function blocksToMarkdown(blocks: TutorBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "summary":
          return [
            b.payload.title ? `## ${b.payload.title}` : "",
            ...b.payload.bullets.map((x) => `- ${x}`),
          ]
            .filter(Boolean)
            .join("\n");
        case "lay_explanation":
          return b.payload.text + (b.payload.analogy ? `\n\n_${b.payload.analogy}_` : "");
        case "deep_dive":
          return b.payload.markdown;
        case "comparison_table": {
          const head = `| ${b.payload.headers.join(" | ")} |`;
          const sep = `| ${b.payload.headers.map(() => "---").join(" | ")} |`;
          const rows = b.payload.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
          return [head, sep, rows].join("\n");
        }
        case "mini_quiz":
          return `**Quiz:** ${b.payload.stem}`;
        case "next_steps":
          return b.payload.actions.map((a) => `→ ${a.label}`).join("\n");
        case "reference":
          return b.payload.refs.map((r) => `- ${r.source}`).join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Garante shape mínimo: filtra blocos inválidos sem quebrar o stream. */
export function normalizeBlocks(raw: unknown[]): TutorBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTutorBlock);
}

/** Constrói TutorStructuredMessage a partir de markdown puro (fallback). */
export function fromMarkdown(markdown: string): TutorStructuredMessage {
  const block = wrapMarkdownAsBlock(markdown);
  return {
    role: "assistant",
    content: markdown,
    blocks: [block],
  };
}

/** Constrói TutorStructuredMessage a partir de lista de blocos. */
export function fromBlocks(blocks: TutorBlock[]): TutorStructuredMessage {
  const safe = normalizeBlocks(blocks);
  return {
    role: "assistant",
    content: blocksToMarkdown(safe),
    blocks: safe,
  };
}

/** Tenta parsear uma linha NDJSON como TutorBlock. Retorna null se inválido. */
export function parseBlockLine(line: string): TutorBlock | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isTutorBlock(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function useTutorBlocks() {
  const toStructured = useCallback(
    (input: { markdown?: string; blocks?: unknown[] }): TutorStructuredMessage => {
      if (input.blocks && input.blocks.length > 0) {
        const safe = normalizeBlocks(input.blocks);
        if (safe.length > 0) return fromBlocks(safe);
      }
      return fromMarkdown(input.markdown ?? "");
    },
    []
  );

  return { toStructured, fromMarkdown, fromBlocks, normalizeBlocks, parseBlockLine };
}
