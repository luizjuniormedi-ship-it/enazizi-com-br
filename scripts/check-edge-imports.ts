/**
 * ENAZIZI — Edge Import Linter
 *
 * Bloqueia que NOVAS edge functions importem helpers internos de _shared/*
 * diretamente. Permitido apenas via _shared/contracts/* ou _shared/public/*.
 *
 * Uso:
 *   bun scripts/check-edge-imports.ts            # report
 *   bun scripts/check-edge-imports.ts --strict   # exit 1 se houver violação nova
 *
 * Histórico/legado é tolerado via allowlist (functions já existentes).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "supabase/functions";
const ALLOWED_PREFIXES = [
  "../_shared/contracts/",
  "../_shared/public/",
];
// Functions that we accept as legacy (won't fail CI). New functions must use contracts.
const LEGACY_ALLOWLIST = new Set<string>([
  "agent-question-quality",
  "ai-pipeline-test",
  "ai-provider-health",
  "ai-proxy",
  "ai-quality-monitor",
  "ai-test",
  "analytics-snapshot",
  "anamnesis-trainer",
  "assistant-log-decision",
  "audit-answer",
  "audit-cognitive-system",
  "auto-generate-image-questions",
  "auto-process-real-images",
  "autonomous-medical-graph",
  "benchmark-percentile",
  "bulk-generate-content",
  "calculate-approval-score",
  "chatgpt-agent",
  "cleanup-contaminated-assets",
  "clinical-simulation",
  "cme-orchestrator",
  "cme-scene-builder",
  "cockpit-data",
  "cognitive-analytics-engine",
  "cognitive-executive-report",
  "cognitive-orchestrator",
  "cognitive-orchestrator-v2",
  "cognitive-recovery-engine",
  "content-summarizer",
  "curate-medical-images",
  "daily-question-generator",
  "dashboard-snapshot",
  "debug-import-cors",
  "discursive-questions",
  "drive-crawler-debug",
  "drive-deep-crawler",
  "drive-exam-ingestion",
  "drive-process-single-file",
  "enamed-generator",
  "error-pattern-engine",
  "explain-deep",
  "explain-simple",
  "extract-exam-questions",
  "extract-exam-visual",
  "extract-official-questions",
  "fatigue-detector",
  "feynman-trainer",
  "generate-adaptive-question",
  "generate-adaptive-simulado",
  "generate-chronicle-osce",
  "generate-content-ai",
  "generate-daily-plan",
  "generate-flashcards",
  "generate-image-questions",
  "generate-image-questions-batch",
  "generate-map-flashcards",
  "generate-map-questions",
  "generate-medical-mnemonic",
  "generate-mind-map",
  "generate-mnemonic",
  "generate-study-guide",
  "generate-tutor-lesson",
  "generate-tutor-v2-lesson",
  "hygiene-block-contaminated-assets",
  "ingest-nih-xrays",
  "ingest-questions",
  "interview-simulator",
  "learning-optimizer",
  "massive-scale-governance",
  "medical-chronicle",
  "medical-reviewer",
  "medical-term-lookup",
  "medical-vision-engine",
  "mentor-chat",
  "micro-quiz",
  "motivational-coach",
  "orchestrator-record-outcome",
  "orchestrator-tune-weights",
  "pedagogical-event-consumer",
  "pedagogical-health-governor",
  "pedagogical-warmup-audit",
  "performance-predictor",
  "planner-orchestrator-v1",
  "populate-questions",
  "practical-exam",
  "process-rag-document",
  "process-upload",
  "professor-reminder",
  "professor-simulado",
  "proficiency-planner",
  "proficiency-progress-recalc",
  "qa-agent",
  "quality-lock-validator",
  "question-generator",
  "question-review-pipeline",
  "reinforce-error",
  "replan-overdue-tasks",
  "schedule-review",
  "search-rag-context",
  "search-real-medical-images",
  "search-real-questions",
  "simulado-assistant",
  "study-complete",
  "study-next",
  "study-orchestrator",
  "study-session",
  "summarize-topic",
  "system-health-check",
  "telemetry-summarizer",
  "trajectory-apply-v1",
  "trajectory-complete-action-v1",
  "trajectory-engine-v1",
  "trajectory-explain-v1",
  "trajectory-health-engine",
  "trajectory-telemetry-v1",
  "tutor-orchestrator-v2",
  "tutor-supervisor-agent",
  "tutor-v2-chat",
  "tutor-v2-context-builder",
  "tutor-v2-provider-health",
  "tutor-v3-premium",
  "unified-telemetry",
  "upgrade-image-questions",
  "upgrade-questions",
]);

const FORBIDDEN_RE =
  /from\s+["']\.\.\/_shared\/([^"'\/]+\.ts)["']/g;

type Violation = { file: string; line: number; importPath: string };
const violations: Violation[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "_shared" || name === "node_modules") continue;
      walk(full);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      scan(full);
    }
  }
}

function scan(file: string) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/from\s+["'](\.\.\/_shared\/[^"']+)["']/);
    if (!m) return;
    const path = m[1];
    if (ALLOWED_PREFIXES.some((p) => path.startsWith(p))) return;
    // skip subdirectory contracts/public deep imports
    if (path.startsWith("../_shared/contracts/")) return;
    if (path.startsWith("../_shared/public/")) return;
    violations.push({ file, line: i + 1, importPath: path });
  });
}

walk(ROOT);

const strict = process.argv.includes("--strict");
const fresh = violations.filter((v) => {
  const fnName = v.file.split("/")[2];
  return !LEGACY_ALLOWLIST.has(fnName);
});

console.log(`[edge-import-linter] scanned ${ROOT}`);
console.log(`[edge-import-linter] total violations: ${violations.length}`);
console.log(`[edge-import-linter] non-legacy violations: ${fresh.length}`);

if (fresh.length > 0 && strict) {
  console.error(
    "[edge-import-linter] STRICT MODE: failing because non-legacy violations exist:",
  );
  for (const v of fresh.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  ->  ${v.importPath}`);
  }
  process.exit(1);
}

if (fresh.length > 0) {
  console.warn("[edge-import-linter] sample violations:");
  for (const v of fresh.slice(0, 20)) {
    console.warn(`  ${v.file}:${v.line}  ${v.importPath}`);
  }
}

process.exit(0);
