import ReactMarkdown from "react-markdown";
import InteractiveQuestionCard, { type InteractiveQuestion } from "./InteractiveQuestionCard";

// Flexible regex for options: a), A), **a)**, a., **A.** etc.
const OPTION_RE = /^\*{0,2}[a-dA-D][).]\*{0,2}\s+/;
const OPTION_LINE_RE = /^\*{0,2}[a-dA-D][).]\*{0,2}\s+.+/gim;
const OPTION_CLEAN_RE = /^\*{0,2}[a-dA-D][).]\*{0,2}\s*/i;

export function parseQuestionsFromMarkdown(text: string): { questions: InteractiveQuestion[]; segments: Array<{ type: "text" | "question"; content?: string; question?: InteractiveQuestion }> } {
  const segments: Array<{ type: "text" | "question"; content?: string; question?: InteractiveQuestion }> = [];
  const questions: InteractiveQuestion[] = [];

  // Split by --- separators first, then by "Questão N" markers
  let parts: string[];
  if (text.includes("---")) {
    parts = text.split(/---+/).filter(p => p.trim());
  } else {
    parts = text.split(/(?=\*{0,2}Questão\s*\d*\s*[:.]\s*\*{0,2})/gi);
  }

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const hasOptions = OPTION_RE.test(trimmed.split("\n").find(l => OPTION_RE.test(l.trim())) || "");
    // Also check multi-line
    const hasOptionsML = OPTION_LINE_RE.test(trimmed);
    OPTION_LINE_RE.lastIndex = 0; // reset regex state

    if (!hasOptions && !hasOptionsML) {
      segments.push({ type: "text", content: trimmed });
      continue;
    }

    const q = parseOneQuestion(trimmed);
    if (q) {
      questions.push(q);
      segments.push({ type: "question", question: q });
    } else {
      segments.push({ type: "text", content: trimmed });
    }
  }

  return { questions, segments };
}

function parseOneQuestion(block: string): InteractiveQuestion | null {
  // Extract topic
  const topicMatch = block.match(/\*{0,2}Tópico\s*:?\s*\*{0,2}\s*\[?\s*([^\]\n*]+?)\s*\]?\s*(?:\n|$)/i);
  const topic = topicMatch?.[1]?.trim().replace(/\*+/g, "") || undefined;

  // Extract explanation
  const explMatch = block.match(/\*{0,2}Explicação\s*:?\s*\*{0,2}\s*([\s\S]*?)(?=\n\*{0,2}(?:Referência|📚|Tópico|Questão)|$)/i);
  const explanation = explMatch?.[1]?.trim().replace(/^\*{1,2}\s*/, "").replace(/\*{1,2}$/g, "") || "";

  // Extract reference
  const refMatch = block.match(/(?:📚\s*(?:Referência:?\s*)?|\*{0,2}Referência\s*:?\s*\*{0,2})\s*(.+)/i);
  const reference = refMatch?.[1]?.trim() || undefined;

  // Extract gabarito - handle **Gabarito:** **A**, Gabarito: a, etc.
  const gabMatch = block.match(/\*{0,2}Gabarito\s*:?\s*\*{0,2}\s*\*{0,2}\s*(.+)/i);
  const gabText = gabMatch?.[1]?.trim().replace(/\*+/g, "").toLowerCase() || "";

  // Extract options with flexible format
  const optionMatches = block.match(OPTION_LINE_RE);
  OPTION_LINE_RE.lastIndex = 0;
  if (!optionMatches || optionMatches.length < 2) return null;

  const firstOptIdx = block.search(/^\*{0,2}[a-dA-D][).]\*{0,2}\s*/im);
  let statement = block.slice(0, firstOptIdx).trim();

  // Clean statement
  statement = statement
    .replace(/\*{0,2}Questão\s*\d*\s*[:.]\s*\*{0,2}\s*/gi, "")
    .replace(/\*{0,2}Tópico\s*:?\s*\*{0,2}\s*\[?[^\]\n]*\]?\s*/gi, "")
    .replace(/^\s*\n+/, "")
    .trim();

  if (!statement) return null;

  const options = optionMatches.map((o) => o.replace(OPTION_CLEAN_RE, "").trim());

  // Determine correct answer
  const letterMatch = gabText.match(/([a-e])/i);
  const correctIndex = letterMatch ? letterMatch[1].toLowerCase().charCodeAt(0) - 97 : 0;

  return { statement, options, correctIndex, explanation, topic, reference };
}

interface Props {
  content: string;
}

const InteractiveQuestionRenderer = ({ content }: Props) => {
  const { segments } = parseQuestionsFromMarkdown(content);
  const hasQuestions = segments.some((s) => s.type === "question");

  if (!hasQuestions) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&>p+p]:mt-4 [&_strong]:text-foreground [&_hr]:my-4 [&_blockquote]:my-3">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  let qIdx = 0;
  return (
    <div className="space-y-4">
      {segments.map((seg, i) => {
        if (seg.type === "text" && seg.content) {
          return (
            <div key={i} className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-3 prose-headings:mt-5 prose-headings:mb-2">
              <ReactMarkdown>{seg.content}</ReactMarkdown>
            </div>
          );
        }
        if (seg.type === "question" && seg.question) {
          const idx = qIdx++;
          return <InteractiveQuestionCard key={i} question={seg.question} index={idx} />;
        }
        return null;
      })}
    </div>
  );
};

export default InteractiveQuestionRenderer;
