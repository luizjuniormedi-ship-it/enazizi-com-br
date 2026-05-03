import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FORBIDDEN_PATTERNS = [
  /google\/gemini/i,
  /gemini-2/i,
  /gemini flash/i,
  /gemini-2\.5/i
];

const IGNORE_DIRS = ['node_modules', '.git', 'dist', '_archive'];
const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

function scanDir(dir) {
  const files = readdirSync(dir);
  let hasError = false;

  for (const file of files) {
    const fullPath = join(dir, file);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        if (scanDir(fullPath)) hasError = true;
      }
      continue;
    }

    if (!ALLOWED_EXTENSIONS.includes(extname(file))) continue;

    const content = readFileSync(fullPath, 'utf-8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`❌ VIOLAÇÃO DETECTADA: Padrão proibido "${pattern}" encontrado em ${fullPath}`);
        hasError = true;
      }
    }
  }
  return hasError;
}

console.log('🛡️ Iniciando AI Guard (OpenAI-only enforcement)...');
const errorInSrc = scanDir('src');
const errorInFunctions = scanDir('supabase/functions');

if (errorInSrc || errorInFunctions) {
  console.error('\n🚨 BUILD FALHOU: Modelos Gemini detectados. Por favor, remova todas as referências ao Google Gemini e use apenas OpenAI.');
  process.exit(1);
} else {
  console.log('✅ AI Guard: Nenhuma referência ao Gemini encontrada nas áreas críticas.');
}
