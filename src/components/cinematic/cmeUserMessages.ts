/**
 * CME — Mapeamento de mensagens técnicas → amigáveis ao usuário final.
 *
 * Override freeze: cme-ux-correct-fix (10/05/2026).
 * Usuário final NUNCA pode ver: TutorCME_Pipeline, worker, queue, stage,
 * Semantic Planning, GPU Rendering, failure stack, recovery engine.
 */

const TECH_PATTERNS: { match: RegExp; humanized: string }[] = [
  {
    match: /nenhuma mensagem encontrada/i,
    humanized:
      "Sua aula ainda está sendo preparada. Tente novamente em alguns instantes.",
  },
  {
    match: /TutorCME_Pipeline|CME_Pipeline|cme pipeline|falha no componente/i,
    humanized: "Ocorreu uma instabilidade temporária na geração da aula.",
  },
  {
    match: /recovery engine|sistema de recupera/i,
    humanized: "Estamos tentando recuperar sua sessão.",
  },
  {
    match: /RENDER_JOB_NOT_CREATED|render job not created|orchestrator/i,
    humanized: "A geração ainda não foi iniciada. Tente novamente em alguns instantes.",
  },
  {
    match: /worker|gpu|hls|cdn|scene graph|semantic planning/i,
    humanized: "Estamos preparando os recursos da aula. Isso pode levar alguns instantes.",
  },
  {
    match: /queue|enqueued|dequeued|stage/i,
    humanized: "Sua aula está na fila de geração.",
  },
];

/** Converte mensagem técnica em mensagem amigável para o usuário final. */
export function humanizeCMEMessage(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) {
    return "Ocorreu uma instabilidade temporária. Tente novamente em alguns instantes.";
  }
  for (const { match, humanized } of TECH_PATTERNS) {
    if (match.test(raw)) return humanized;
  }
  // Mensagem desconhecida: cair no genérico amigável.
  return "Ocorreu uma instabilidade temporária na geração da aula.";
}

/** Status amigáveis exibidos ao usuário final. */
export const FRIENDLY_STATUS_LABEL: Record<string, string> = {
  processing: "Preparando sua aula…",
  ready: "Aula pronta!",
  failed: "Não conseguimos preparar a aula agora",
  waiting_hardware: "Aguardando início da geração…",
};

/** Estágios técnicos → rótulo amigável (apenas o essencial visível). */
export function friendlyStageLabel(progress: number): string {
  if (progress >= 100) return "Concluído";
  if (progress >= 80) return "Finalizando geração…";
  if (progress >= 50) return "Renderizando aula…";
  if (progress >= 25) return "Organizando o conteúdo…";
  return "Preparando sua aula…";
}
