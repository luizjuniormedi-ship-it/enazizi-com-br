/**
 * ENAZIZI — Injection Guard
 * 
 * Detecta tentativas de prompt injection no input do usuário.
 * Usado por tutor-v2-chat e mentor-chat para bloquear antes de chamar a IA.
 */

const INJECTION_PATTERNS: RegExp[] = [
  // English patterns
  /ignore\s+(all\s+)?(previous|above|prior|system)?\s*(instructions|prompts|rules|context)/i,
  /forget\s+(all\s+)?(your|previous|the)?\s*(instructions|rules|training|context|prompt)/i,
  /disregard\s+(all\s+)?(previous|above|prior|your)?\s*(instructions|prompts|rules)/i,
  /override\s+(all\s+)?(previous|your|system)?\s*(instructions|rules|prompts)/i,
  /you\s+are\s+now\s+(a|an|my)\s+/i,
  /pretend\s+(to\s+be|you\s*'?re|that\s+you)/i,
  /act\s+as\s+(if|a|an|my)\s+/i,
  /new\s+(persona|identity|character|role|mode)/i,
  /system\s*prompt|reveal\s+(your|the)\s+(prompt|instructions|system)/i,
  /jailbreak|DAN\s+mode|developer\s+mode|god\s+mode/i,
  /bypass\s+(your|the|all)\s+(rules|restrictions|filters|safety)/i,
  
  // Portuguese patterns
  /ignore\s+(todas?\s+)?(as\s+)?(instruções|regras|ordens)?\s*(anteriores|acima|prévias)?/i,
  /esqueça\s+(todas?\s+)?(as\s+)?(instruções|regras|ordens)/i,
  /desconsidere\s+(todas?\s+)?(as\s+)?(instruções|regras)/i,
  /você\s+agora\s+é\s+(um|uma|o|a)\s+/i,
  /finja\s+(ser|que\s+(é|você))/i,
  /aja\s+como\s+(se|um|uma)/i,
  /mude\s+(sua|de)\s+(personalidade|identidade|papel)/i,
  /revele\s+(seu|o)\s+(prompt|sistema|instruções)/i,
  /modo\s+(desenvolvedor|deus|livre|sem\s+filtro)/i,
  /seja\s+(um|uma|o|a)\s+(pirata|cachorro|personagem|dan)/i,
];

/**
 * Detecta se o texto contém padrões de prompt injection.
 * Retorna true se injection detectada.
 */
export function detectInjection(text: string): boolean {
  if (!text || text.length < 10) return false;
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Resposta padrão quando injection é detectada.
 */
export const SAFE_RESPONSE = "Sou seu mentor médico ENAZIZI. Vamos focar no seu aprendizado. Qual tema médico posso te ajudar a dominar?";

/**
 * Verifica se o texto é uma tentativa de sair do domínio médico
 * (menos agressivo que injection — apenas redireciona).
 */
export function isOffTopic(text: string): boolean {
  const lower = text.toLowerCase();
  const offTopicPatterns = [
    /como\s+fazer\s+(uma\s+)?bomba/i,
    /como\s+(hackear|invadir|roubar)/i,
    /me\s+ensine\s+a\s+(matar|roubar|hackear)/i,
    /conte\s+(uma\s+)?piada/i,
    /escreva\s+(um\s+)?(poema|código|programa|script)/i,
  ];
  return offTopicPatterns.some(p => p.test(text));
}

export const OFF_TOPIC_RESPONSE = "Entendo sua curiosidade, mas minha especialidade é medicina e preparação para provas médicas. Posso te ajudar com algum tema clínico, fisiopatologia, ou preparação para residência?";
