/**
 * ENAZIZI Route Map — Fonte única de verdade para auditoria de navegação.
 * Reflete a estrutura real definida em App.tsx.
 */

export const ROUTE_MAP = {
  public: [
    "/",
    "/login",
    "/register",
    "/install",
    "/reset-password",
    "/videoaulas/:id", // Versão pública/compartilhada
    "/demo-questoes-imagem"
  ],
  protected: {
    dashboard: [
      "/dashboard",
      "/dashboard/perfil",
      "/dashboard/analytics",
      "/dashboard/sessao-estudo",
      "/dashboard/flashcards",
      "/dashboard/simulados",
      "/dashboard/banco-erros",
      "/dashboard/videoaulas",
      "/dashboard/videoaulas/explorar",
      "/dashboard/videoaulas/:id",
      "/dashboard/mentor", // Tutor IA
      "/dashboard/planner", // Smart Planner
      "/dashboard/mnemonic-studio-v2",
      "/dashboard/mnemonic-history",
      "/dashboard/mapas-mentais",
      "/dashboard/mapas-mentais/:id",
      "/dashboard/plantao",
      "/dashboard/anamnese",
      "/dashboard/discursivas",
      "/dashboard/prova-pratica",
      "/dashboard/predictor",
      "/dashboard/diagnostico",
      "/dashboard/conquistas",
      "/dashboard/image-quiz",
      "/dashboard/rankings",
      "/dashboard/revisor",
      "/dashboard/entrevista",
      "/dashboard/cronicas",
      "/dashboard/minha-jornada",
      "/dashboard/agentes",
      "/dashboard/resumos",
      "/dashboard/apostilas",
      "/dashboard/coach",
      "/dashboard/uploads",
      "/dashboard/mapa-dominio",
      "/dashboard/proficiencia"
    ],
    enaflix: [
      "/enaflix",
      "/enaflix/tudo"
    ],
    mission: [
      "/mission",
      "/mission-control"
    ],
    specialized: [
      "/professor",
      "/professor/proficiencia/piloto",
      "/institucional"
    ]
  },
  admin: [
    "/admin",
    "/admin/users",
    "/admin/ingestion-network",
    "/admin/monitoring",
    "/admin/ceo",
    "/admin/metrics",
    "/admin/orchestrator-insights",
    "/admin/validation",
    "/admin/coverage",
    "/admin/coverage-boost",
    "/admin/classification",
    "/admin/classification-runner",
    "/admin/classification-health",
    "/admin/cme-status",
    "/admin/cme-incidents",
    "/admin/curriculum-coverage",
    "/admin/granular-generator",
    "/admin/generator-telemetry",
    "/admin/banca-readiness",
    "/admin/simulado-selection",
    "/admin/tutor-memory",
    "/admin/tutor-video-recommendations",
    "/admin/telemetry",
    "/admin/ai-studio",
    "/admin/medical-review-queue",
    "/admin/medical-governance",
    "/admin/ai-audit-mode",
    "/admin/notebooklm",
    "/admin/video-lessons",
    "/admin/specialty-friction",
    "/admin/ingestion-provas",
    "/admin/knowledge-graph",
    "/admin/adaptive-engine",
    "/admin/intervention-policies",
    "/admin/cinematic-engine",
    "/admin/cme-origins",
    "/admin/cme-audit",
    "/admin/cme-executive",
    "/admin/gpu-fleet",
    "/admin/render-queues",
    "/admin/cme-observability",
    "/admin/system-checklist"
  ],
  dev: [
    "/dev/cognitive"
  ]
};

/**
 * Aliases e Redirecionamentos (para documentação)
 */
export const ROUTE_ALIASES = {
  "/dashboard/cronograma": "/dashboard/planner",
  "/dashboard/cronograma-inteligente": "/dashboard/planner",
  "/dashboard/quiz": "/dashboard/sessao-estudo",
  "/dashboard/revisoes": "/dashboard/sessao-estudo?focus=reviews",
  "/dashboard/tutor": "/dashboard/sessao-estudo",
  "/dashboard/questoes": "/dashboard/simulados",
  "/dashboard/banco-questoes": "/dashboard/simulados",
  "/dashboard/plano-dia": "/dashboard",
  "/dashboard/feynman": "/dashboard/mentor",
  "/dashboard/mnemonico": "/dashboard/mnemonic-studio-v2",
  "/dashboard/mnemonic-studio": "/dashboard/mnemonic-studio-v2",
  "/dashboard/missao": "/mission",
  "/dashboard/minhas-aulas": "/dashboard/videoaulas",
  "/study/*": "/dashboard/*"
};
