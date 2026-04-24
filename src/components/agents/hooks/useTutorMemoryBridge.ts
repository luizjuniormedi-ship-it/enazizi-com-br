/**
 * useTutorMemoryBridge — Sprint Memória Pedagógica
 *
 * Ponte entre o `useAgentChat` (chat principal do Tutor) e a camada de
 * memória pedagógica em `src/lib/tutor/tutorMemory.ts`.
 *
 * Responsabilidades:
 *  - PRÉ-IA: normalizar pergunta e procurar reuso (`lookup`).
 *  - PÓS-IA: extrair blocos da resposta e persistir (`persist`).
 *  - Marcar reutilização (`markReused`).
 *  - Decidir `quality_score` inicial.
 *
 * NÃO altera streaming, edge functions, FSRS ou orchestrator.
 * Falhas são silenciosas — chat sempre continua.
 */
import { useCallback, useRef } from "react";
import {
  findReusableMemory,
  markMemoryReused,
  saveTutorMemory,
  type TutorMemoryRow,
} from "@/lib/tutor/tutorMemory";
import {
  hasPersonalContext,
  shouldBypassMemory,
} from "@/lib/tutor/normalizeQuestion";
import type { TutorBlock } from "@/types/tutor";

export interface MemoryLookupResult {
  hit: TutorMemoryRow;
  /** Markdown reconstruído para alimentar o stream local (preserva UX). */
  markdown: string;
}

export interface PersistMemoryArgs {
  question: string;
  answerMarkdown: string;
  userId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  /** Modelos cognitivos detectados na resposta (vazio quando só markdown). */
  blocks?: TutorBlock[];
  modelUsed?: string | null;
}

interface UseTutorMemoryBridgeOpts {
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  /** Quando true, força bypass da memória nesta próxima chamada. */
  forceBypassRef?: React.MutableRefObject<boolean>;
}

const MIN_REUSE_QUALITY = 80;

/**
 * Reconstrói markdown a partir de blocos cognitivos para reutilização.
 * Mantém compatibilidade total com o renderer atual de markdown.
 */
function blocksToReadableMarkdown(blocks: TutorBlock[]): string {
  if (!blocks || blocks.length === 0) return "";
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "summary": {
        if (b.payload.title) parts.push(`## ${b.payload.title}`);
        parts.push((b.payload.bullets ?? []).map((x) => `- ${x}`).join("\n"));
        break;
      }
      case "lay_explanation": {
        parts.push(b.payload.text);
        if (b.payload.analogy) parts.push(`\n_${b.payload.analogy}_`);
        break;
      }
      case "deep_dive":
        parts.push(b.payload.markdown);
        break;
      case "comparison_table": {
        const head = `| ${b.payload.headers.join(" | ")} |`;
        const sep = `| ${b.payload.headers.map(() => "---").join(" | ")} |`;
        const rows = (b.payload.rows ?? [])
          .map((r) => `| ${r.join(" | ")} |`)
          .join("\n");
        parts.push([head, sep, rows].join("\n"));
        break;
      }
      case "next_steps":
        parts.push((b.payload.actions ?? []).map((a) => `→ ${a.label}`).join("\n"));
        break;
      default:
        // blocos cognitivos pesados não viram markdown legível;
        // o usuário ainda vê o conteúdo via re-render quando aplicável.
        break;
    }
  }
  return parts.filter(Boolean).join("\n\n").trim();
}

/**
 * Heurística simples de pontuação inicial:
 *  - 80 quando há blocos cognitivos visuais (clinical_flow, ddx, pharma, semio)
 *  - 70 para resposta padrão (markdown / deep_dive)
 *  - 60 quando o conteúdo é muito curto (provável payload incompleto)
 */
function computeInitialQuality(args: {
  answerMarkdown: string;
  blocks?: TutorBlock[];
}): number {
  const cognitiveTypes = new Set<string>([
    "clinical_flow",
    "differential_diagnosis",
    "pharmacology_compare",
    "semiology_insight",
  ]);
  const hasCognitive = (args.blocks ?? []).some((b) =>
    cognitiveTypes.has(b.type),
  );
  if (hasCognitive) return 80;
  const len = (args.answerMarkdown ?? "").trim().length;
  if (len < 240) return 60;
  return 70;
}

export function useTutorMemoryBridge(opts: UseTutorMemoryBridgeOpts = {}) {
  const lastHitRef = useRef<TutorMemoryRow | null>(null);

  const lookup = useCallback(
    async (
      question: string,
      userId: string | null | undefined,
    ): Promise<MemoryLookupResult | null> => {
      try {
        if (!question) return null;
        if (opts.forceBypassRef?.current) {
          opts.forceBypassRef.current = false;
          return null;
        }
        if (shouldBypassMemory(question)) return null;

        const hit = await findReusableMemory({
          question,
          userId: userId ?? null,
          topic: opts.topic ?? null,
          subtopic: opts.subtopic ?? null,
          minQuality: MIN_REUSE_QUALITY,
        });
        if (!hit) return null;

        const markdown = blocksToReadableMarkdown(hit.blocks ?? []);
        if (!markdown) return null;

        lastHitRef.current = hit;
        // increment reuse_count (fire-and-forget)
        markMemoryReused(hit.id).catch(() => {});
        return { hit, markdown };
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[tutorMemory] lookup failed:", err);
        }
        return null;
      }
    },
    [opts.topic, opts.subtopic, opts.forceBypassRef],
  );

  const persist = useCallback(
    async (args: PersistMemoryArgs): Promise<TutorMemoryRow | null> => {
      try {
        const text = (args.answerMarkdown ?? "").trim();
        if (!text || !args.question) return null;

        // Constrói pelo menos um deep_dive como fallback de bloco salvo,
        // garantindo que a memória sempre tenha algo renderizável.
        const blocks: TutorBlock[] =
          args.blocks && args.blocks.length > 0
            ? args.blocks
            : [
                {
                  type: "deep_dive",
                  payload: { markdown: text },
                },
              ];

        const qualityScore = computeInitialQuality({
          answerMarkdown: text,
          blocks: args.blocks,
        });

        const personal = hasPersonalContext(args.question);

        return await saveTutorMemory({
          question: args.question,
          blocks,
          userId: args.userId ?? null,
          topic: args.topic ?? opts.topic ?? null,
          subtopic: args.subtopic ?? opts.subtopic ?? null,
          specialty: args.specialty ?? opts.specialty ?? null,
          intent: null,
          difficultyLevel: null,
          answerSummary: text.slice(0, 500),
          qualityScore,
          modelUsed: args.modelUsed ?? null,
          forceUserScope: personal,
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[tutorMemory] persist failed:", err);
        }
        return null;
      }
    },
    [opts.topic, opts.subtopic, opts.specialty],
  );

  return { lookup, persist, lastHitRef };
}
