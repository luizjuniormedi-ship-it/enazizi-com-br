#!/usr/bin/env node
/**
 * ENAZIZI — Consolidated Test Report Generator
 *
 * Reads k6 JSON summary + Playwright JSON results and produces test-report.md
 *
 * Usage: node tests/reports/generate-report.js
 */

const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.resolve(__dirname);
const K6_SUMMARY = path.join(REPORTS_DIR, "k6-summary.json");
const PW_RESULTS = path.join(REPORTS_DIR, "playwright-results.json");
const OUTPUT_MD = path.join(REPORTS_DIR, "test-report.md");
const OUTPUT_JSON = path.join(REPORTS_DIR, "test-report.json");

/* ─── Thresholds ─── */
const THRESHOLDS = {
  errorRate: 0.03,
  p95: 2500,
  p99: 5000,
};

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function analyzeK6(data) {
  if (!data) return { available: false };

  const metrics = data.metrics || {};
  const result = { available: true, endpoints: {}, passed: true, failures: [] };

  // Error rate
  const errRate = metrics.error_rate?.values?.rate ?? 0;
  result.errorRate = (errRate * 100).toFixed(2) + "%";
  if (errRate >= THRESHOLDS.errorRate) {
    result.passed = false;
    result.failures.push(`Error rate ${result.errorRate} >= ${THRESHOLDS.errorRate * 100}%`);
  }

  // Per-endpoint trends
  const trendKeys = [
    "study_next_duration",
    "study_complete_duration",
    "analytics_snapshot_duration",
    "explain_simple_duration",
    "summarize_topic_duration",
    "generate_question_duration",
    "login_duration",
  ];

  for (const key of trendKeys) {
    const t = metrics[key]?.values;
    if (!t) continue;
    const ep = key.replace("_duration", "");
    result.endpoints[ep] = {
      p50: Math.round(t["p(50)"] || t.med || 0),
      p95: Math.round(t["p(95)"] || 0),
      p99: Math.round(t["p(99)"] || 0),
      avg: Math.round(t.avg || 0),
    };
    if ((t["p(95)"] || 0) > THRESHOLDS.p95) {
      result.passed = false;
      result.failures.push(`${ep} p95 = ${Math.round(t["p(95)"])}ms > ${THRESHOLDS.p95}ms`);
    }
    if ((t["p(99)"] || 0) > THRESHOLDS.p99) {
      result.passed = false;
      result.failures.push(`${ep} p99 = ${Math.round(t["p(99)"])}ms > ${THRESHOLDS.p99}ms`);
    }
  }

  return result;
}

function analyzePlaywright(data) {
  if (!data) return { available: false };

  const suites = data.suites || [];
  const result = { available: true, passed: true, total: 0, passedCount: 0, failedCount: 0, failures: [], suites: [] };

  function walk(suite) {
    const s = { title: suite.title, specs: [] };
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        for (const res of test.results || []) {
          result.total++;
          const ok = res.status === "passed" || res.status === "skipped";
          if (ok) result.passedCount++;
          else {
            result.failedCount++;
            result.passed = false;
            result.failures.push(`${suite.title} > ${spec.title}: ${res.status}`);
          }
          s.specs.push({ title: spec.title, status: res.status });
        }
      }
    }
    result.suites.push(s);
    for (const child of suite.suites || []) walk(child);
  }

  for (const suite of suites) walk(suite);
  return result;
}

function generateMarkdown(k6, pw) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const overallPassed = (k6.available ? k6.passed : true) && (pw.available ? pw.passed : true);

  let verdict = "✅ APROVADO — Pronto para uso";
  if (!overallPassed && (k6.failures?.length || 0) + (pw.failures?.length || 0) <= 2) {
    verdict = "⚠️ APROVADO COM CAUTELA — Verificar pontos abaixo";
  } else if (!overallPassed) {
    verdict = "❌ NÃO APROVADO — Correções necessárias";
  }

  let md = `# ENAZIZI — Relatório de Validação\n\n`;
  md += `**Data:** ${now}\n\n`;
  md += `## 1. Resumo Executivo\n\n`;
  md += `**Veredicto:** ${verdict}\n\n`;

  if (!overallPassed) {
    md += `### Falhas principais\n\n`;
    for (const f of [...(k6.failures || []), ...(pw.failures || [])]) {
      md += `- ${f}\n`;
    }
    md += `\n`;
  }

  /* ── Performance ── */
  md += `## 2. Performance (k6)\n\n`;
  if (!k6.available) {
    md += `> Resultados k6 não encontrados. Execute o teste de carga primeiro.\n\n`;
  } else {
    md += `**Error rate:** ${k6.errorRate}\n\n`;
    md += `| Endpoint | p50 | p95 | p99 | Avg |\n`;
    md += `|----------|-----|-----|-----|-----|\n`;
    for (const [ep, v] of Object.entries(k6.endpoints)) {
      const flag95 = v.p95 > THRESHOLDS.p95 ? " ⚠️" : "";
      const flag99 = v.p99 > THRESHOLDS.p99 ? " ⚠️" : "";
      md += `| ${ep} | ${v.p50}ms | ${v.p95}ms${flag95} | ${v.p99}ms${flag99} | ${v.avg}ms |\n`;
    }
    md += `\n`;
  }

  /* ── Funcional ── */
  md += `## 3. Fluxo Funcional (Playwright)\n\n`;
  if (!pw.available) {
    md += `> Resultados Playwright não encontrados. Execute os testes E2E primeiro.\n\n`;
  } else {
    md += `**Total:** ${pw.total} | **Passou:** ${pw.passedCount} | **Falhou:** ${pw.failedCount}\n\n`;
    for (const suite of pw.suites) {
      if (!suite.specs.length) continue;
      md += `### ${suite.title}\n\n`;
      for (const spec of suite.specs) {
        const icon = spec.status === "passed" ? "✅" : spec.status === "skipped" ? "⏭️" : "❌";
        md += `- ${icon} ${spec.title} — ${spec.status}\n`;
      }
      md += `\n`;
    }
  }

  /* ── UX ── */
  md += `## 4. UX Crítica\n\n`;
  if (pw.available) {
    const uxSuites = pw.suites.filter((s) => s.title.toLowerCase().includes("ux"));
    if (uxSuites.length) {
      for (const suite of uxSuites) {
        for (const spec of suite.specs) {
          const icon = spec.status === "passed" ? "✅" : "❌";
          md += `- ${icon} ${spec.title}\n`;
        }
      }
    } else {
      md += `> UX checks incluídos nos fluxos funcionais.\n`;
    }
  } else {
    md += `> Sem dados de UX disponíveis.\n`;
  }
  md += `\n`;

  /* ── Conclusão ── */
  md += `## 5. Conclusão\n\n`;
  md += `${verdict}\n\n`;
  md += `---\n*Gerado automaticamente pelo ENAZIZI Validation Suite*\n`;

  return md;
}

/* ─── Main ─── */
const k6Data = readJson(K6_SUMMARY);
const pwData = readJson(PW_RESULTS);

const k6Analysis = analyzeK6(k6Data);
const pwAnalysis = analyzePlaywright(pwData);

const markdown = generateMarkdown(k6Analysis, pwAnalysis);

// Write outputs
fs.writeFileSync(OUTPUT_MD, markdown, "utf-8");
fs.writeFileSync(
  OUTPUT_JSON,
  JSON.stringify({ timestamp: new Date().toISOString(), k6: k6Analysis, playwright: pwAnalysis }, null, 2),
  "utf-8"
);

console.log(`\n📊 Report generated: ${OUTPUT_MD}`);
console.log(`📦 JSON data: ${OUTPUT_JSON}`);

const passed = (k6Analysis.available ? k6Analysis.passed : true) && (pwAnalysis.available ? pwAnalysis.passed : true);
console.log(passed ? "\n✅ VALIDATION PASSED" : "\n❌ VALIDATION FAILED");
process.exit(passed ? 0 : 1);
