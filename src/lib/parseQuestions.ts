/**
 * Parses AI-generated question text (CESPE or multiple choice) into structured data.
 * Handles various AI output formats with or without markdown.
 */

export interface ParsedQuestion {
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic?: string;
}

// Flexible option regex: a), A), **a)**, a., **A.** etc.
const OPTION_LINE_RE = /^\*{0,2}[a-dA-D][).]\*{0,2}\s+.+/gim;
const OPTION_CLEAN_RE = /^\*{0,2}[a-dA-D][).]\*{0,2}\s*/i;

export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  // Try splitting by --- separators first
  let parts: string[];
  if (text.includes("---")) {
    parts = text.split(/---+/).filter((b) => b.trim());
  } else {
    // Try splitting by numbered questions: "Questão 01", "Questão 1", etc.
    parts = text.split(/(?=\*{0,2}Questão\s+\d+\s*:?\s*\*{0,2})/gi).filter((b) => b.trim());

    // If that yields only 1 block, try splitting by Tópico markers
    if (parts.length <= 1) {
      parts = text.split(/(?=\*{0,2}Tópico\s*:)/gi).filter((b) => b.trim());
    }

    // If still 1 block, try splitting by standalone "Questão:" (without number)
    if (parts.length <= 1) {
      parts = text.split(/(?=\*{0,2}Questão\s*:\s*\*{0,2})/gi).filter((b) => b.trim());
    }
  }

  for (const part of parts) {
    // Check for CESPE or multiple choice options (flexible)
    const hasCespe = /\(\s*\)\s*certo/i.test(part);
    OPTION_LINE_RE.lastIndex = 0;
    const hasOptions = OPTION_LINE_RE.test(part);
    OPTION_LINE_RE.lastIndex = 0;

    if (!hasCespe && !hasOptions) continue;
    try {
      const q = parseBlock(part.trim());
      if (q) questions.push(q);
    } catch {
      // skip
    }
  }

  return questions;
}

function parseBlock(block: string): ParsedQuestion | null {
  // Extract topic: Tópico: X / **Tópico:** X / Tópico: [X]
  const topicMatch = block.match(/\*{0,2}Tópico\s*:?\s*\*{0,2}\s*\[?\s*([^\]\n]+?)\s*\]?\s*(?=Questão|$|\n)/i);
  let topic: string | undefined;
  if (topicMatch) {
    const raw = topicMatch[1].trim().replace(/\*+/g, "");
    if (raw.length > 0 && raw.length < 80) {
      topic = raw;
    }
  }

  // Extract explanation
  const explMatch = block.match(/\*{0,2}Explicação\s*:?\s*\*{0,2}\s*([\s\S]*?)$/i);
  const explanation = explMatch?.[1]?.trim().replace(/^\*{1,2}\s*/, "") || "";

  // Extract gabarito - handle **Gabarito:** **A**, Gabarito: a, etc.
  const gabMatch = block.match(/\*{0,2}Gabarito\s*:?\s*\*{0,2}\s*\*{0,2}\s*(.+)/i);
  const gabText = gabMatch?.[1]?.trim().replace(/\*+/g, "").toLowerCase() || "";

  // CESPE (Certo/Errado)
  const isCespe = /\(\s*\)\s*certo\s*\(\s*\)\s*errado/i.test(block);

  if (isCespe) {
    let statement = block.split(/\(\s*\)\s*certo/i)[0].trim();
    statement = cleanStatement(statement);
    if (!statement) return null;

    const correctIndex = gabText.includes("certo") ? 0 : 1;
    return { statement, options: ["Certo", "Errado"], correctIndex, explanation, topic };
  }

  // Multiple choice with flexible format
  const optionMatches = block.match(OPTION_LINE_RE);
  OPTION_LINE_RE.lastIndex = 0;
  if (optionMatches && optionMatches.length >= 2) {
    const firstOptIdx = block.search(/^\*{0,2}[a-dA-D][).]\*{0,2}\s*/im);
    let statement = block.slice(0, firstOptIdx).trim();
    statement = cleanStatement(statement);
    const options = optionMatches.map((o) => o.replace(OPTION_CLEAN_RE, "").trim());

    const letterMatch = gabText.match(/([a-e])/i);
    const correctIndex = letterMatch ? letterMatch[1].toLowerCase().charCodeAt(0) - 97 : 0;

    if (!statement) return null;
    return { statement, options, correctIndex, explanation, topic };
  }

  return null;
}

function cleanStatement(text: string): string {
  return text
    .replace(/\*{0,2}Questão\s*\d*\s*:?\s*\*{0,2}\s*/gi, "")
    .replace(/\*{0,2}Tópico\s*:?\s*\*{0,2}\s*\[[^\]]*\]\s*/gi, "")
    .replace(/\*{0,2}Tópico\s*:?\s*\*{0,2}\s*[^\n(]{1,80}(?=\s)/i, "")
    .replace(/^\s*\([^)]{0,30}\)\s*/i, "") // Remove orphan parenthetical at start
    .trim();
}
