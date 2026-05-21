/**
 * extractInlineTutorBlocks — Extrai blocos cognitivos JSON embutidos no
 * markdown gerado pelo Tutor IA e devolve o markdown limpo + a lista de blocos.
 *
 * Detecta padrões como:
 *   { "type": "clinical_flow", "payload": {...} }
 *   ```json\n{ "type": "differential_diagnosis", ... }\n```
 *
 * Robusto a JSON parcial (durante stream) — só aceita blocos com chaves balanceadas.
 */
import type { TutorBlock } from "@/types/tutor";
import { isTutorBlock } from "@/types/tutor";

const COGNITIVE_TYPES = new Set([
  "clinical_flow",
  "differential_diagnosis",
  "pharmacology_compare",
  "semiology_insight",
  "summary",
  "deep_dive",
  "comparison_table",
  "mini_quiz",
  "mnemonic_reinforce",
  "next_steps",
  "reference",
  "lay_explanation",
]);

/**
 * Encontra o índice do '}' que fecha o bloco JSON iniciado em `start` ('{').
 * Retorna -1 se não fechar.
 */
function findJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function extractInlineTutorBlocks(markdown: string): {
  cleanedMarkdown: string;
  blocks: TutorBlock[];
} {
  if (!markdown || typeof markdown !== "string") {
    return { cleanedMarkdown: markdown || "", blocks: [] };
  }

  const blocks: TutorBlock[] = [];
  let cleaned = markdown;

  // Regex flexível: captura "type": "<conhecido>"
  const typeRegex = /"type"\s*:\s*"([a-z_]+)"/g;
  const found: { start: number; end: number; raw: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = typeRegex.exec(cleaned)) !== null) {
    const typeName = match[1];
    if (!COGNITIVE_TYPES.has(typeName)) continue;

    // Buscar a chave de abertura mais próxima ANTES da posição do match
    let openIdx = -1;
    for (let i = match.index; i >= 0; i--) {
      if (cleaned[i] === "{") {
        openIdx = i;
        break;
      }
      // Para se achar fim de bloco anterior
      if (cleaned[i] === "}") break;
    }
    if (openIdx === -1) continue;

    const closeIdx = findJsonEnd(cleaned, openIdx);
    if (closeIdx === -1) continue;

    const raw = cleaned.slice(openIdx, closeIdx + 1);
    found.push({ start: openIdx, end: closeIdx + 1, raw });
    typeRegex.lastIndex = closeIdx + 1;
  }

  // Processar de trás pra frente para preservar índices ao remover
  for (let i = found.length - 1; i >= 0; i--) {
    const { start, end, raw } = found[i];
    try {
      const parsed = JSON.parse(raw);
      if (isTutorBlock(parsed)) {
        blocks.unshift(parsed);
        // Remove o JSON e qualquer cerca ```json/``` adjacente
        let removeStart = start;
        let removeEnd = end;
        // Olhar para trás por ```json
        const before = cleaned.slice(Math.max(0, start - 12), start);
        const fenceMatch = before.match(/```json\s*$/);
        if (fenceMatch) removeStart = start - fenceMatch[0].length;
        // Olhar à frente por ```
        const after = cleaned.slice(end, Math.min(cleaned.length, end + 6));
        const closeFence = after.match(/^\s*```/);
        if (closeFence) removeEnd = end + closeFence[0].length;

        cleaned = cleaned.slice(0, removeStart) + cleaned.slice(removeEnd);
      }
    } catch (err) {
      // JSON parcial (stream) → ignora silenciosamente, mas loga se for erro de sintaxe bizarro
      if (raw.length > 20 && !raw.endsWith('}')) {
        // Provavelmente stream incompleto, esperado.
      } else {
        console.warn("[extractInlineTutorBlocks] JSON parse failed for potential block:", err);
      }
    }

  }

  return { cleanedMarkdown: cleaned.trim(), blocks };
}
