#!/usr/bin/env node
/**
 * Tailwind Ambiguous Class Guard
 * ------------------------------------------------------------------
 * Impede a reintrodução de classes arbitrárias ambíguas que disparam
 * warnings do Tailwind JIT (duration-[Nms], ease-[cubic-bezier(...)]).
 *
 * Uso:
 *   node scripts/check-tailwind-ambiguous.mjs
 *
 * Exit code:
 *   0 — nenhum padrão ambíguo encontrado
 *   1 — padrões ambíguos detectados (lista impressa)
 *
 * Forma desambiguada recomendada:
 *   duration-[900ms]            -> [transition-duration:900ms]
 *   ease-[cubic-bezier(...)]    -> [transition-timing-function:cubic-bezier(...)]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Padrões proibidos (Tailwind JIT ambiguous arbitrary values)
const PATTERNS = [
  {
    re: /\bduration-\[\d+m?s\]/g,
    fix: "[transition-duration:Nms]",
    label: "duration-[Nms]",
  },
  {
    re: /\bease-\[cubic-bezier\([^\]]+\)\]/g,
    fix: "[transition-timing-function:cubic-bezier(...)]",
    label: "ease-[cubic-bezier(...)]",
  },
];

const EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

/** @param {string} dir */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      yield* walk(full);
    } else {
      const dot = name.lastIndexOf(".");
      if (dot < 0) continue;
      if (EXTS.has(name.slice(dot))) yield full;
    }
  }
}

let violations = 0;
const hits = [];

for (const file of walk(SRC)) {
  const content = readFileSync(file, "utf8");
  for (const { re, fix, label } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;
      hits.push({
        file: relative(ROOT, file),
        line: lineNum,
        match: m[0],
        label,
        fix,
      });
      violations++;
    }
  }
}

if (violations === 0) {
  console.log("✅ Tailwind guard: nenhuma classe arbitrária ambígua encontrada.");
  process.exit(0);
}

console.error(`\n❌ Tailwind guard: ${violations} ocorrência(s) ambígua(s) detectada(s):\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}`);
  console.error(`    encontrado: ${h.match}`);
  console.error(`    use:        ${h.fix}\n`);
}
console.error(
  "Substitua pela forma desambiguada (propriedade CSS explícita) para evitar warnings JIT.\n",
);
process.exit(1);
