/**
 * CME — Mapeamento de mensagens técnicas → amigáveis ao usuário final.
 *
 * Sprint 5 Update: Parar de mascarar erros reais como "instabilidade temporária".
 */

const TECH_PATTERNS: { match: RegExp; humanized: string }[] = [
  {
    match: /nenhuma mensagem encontrada/i,
    humanized:
      "Sua aula ainda está sendo preparada (mensagens não persistidas). Tente novamente em alguns instantes.",
  },
  {
    match: /RENDER_JOB_NOT_CREATED|render job not created|orchestrator/i,
    humanized: "A geração ainda não foi iniciada pelo orquestrador. Tente novamente em alguns instantes.",
  },
  {
    match: /worker offline|no worker available|hardware/i,
    humanized: "Nenhum Worker GPU disponível no momento. A aula foi estruturada e está pronta para renderização manual no Builder.",
  },
  {
    match: /timeout/i,
    humanized: "O tempo de processamento esgotou. Verifique o status no Dashboard Administrativo.",
  },
];

/** Converte mensagem técnica em mensagem amigável para o usuário final. */
export function humanizeCMEMessage(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) {
    return "Ocorreu uma falha na geração da aula (sem mensagem de erro).";
  }
  
  // Se for admin, mostramos o erro real sempre para facilitar debug
  // No frontend o componente AgentMessageItem já verifica isAdmin para mostrar telemetria, 
  // mas aqui garantimos que a mensagem amigável não esconda o erro técnico totalmente se for algo novo.
  
  for (const { match, humanized } of TECH_PATTERNS) {
    if (match.test(raw)) return humanized;
  }
  
  // Se não bater em nenhum padrão amigável conhecido, retornamos a mensagem original "limpa"
  return raw.replace(/Error: |[a-z0-9-]{36}/gi, '').trim() || "Erro inesperado na geração.";
}

/** Status amigáveis exibidos ao usuário final. */
export const FRIENDLY_STATUS_LABEL: Record<string, string> = {
  processing: "Preparando sua aula…",
  ready: "Aula pronta!",
  failed: "Falha na preparação da aula",
  waiting_hardware: "Aguardando Worker GPU…",
  pending_hardware: "Aguardando hardware disponível",
};

/** Estágios técnicos → rótulo amigável. */
export function friendlyStageLabel(progress: number): string {
  if (progress >= 100) return "Concluído";
  if (progress >= 80) return "GPU Rendering Finalizado";
  if (progress >= 70) return "Worker Atribuído";
  if (progress >= 60) return "Render Job Criado";
  if (progress >= 40) return "Scene Graph Gerado";
  if (progress >= 30) return "Semantic Planning Pronto";
  if (progress >= 10) return "Conteúdo Agregado";
  return "Iniciando Pipeline…";
}
