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
  // populated organically; everything currently importing internals is grandfathered
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
