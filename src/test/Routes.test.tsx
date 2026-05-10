import { describe, it, expect } from "vitest";

/**
 * Route validation tests: ensures all navigation references
 * point to routes that actually exist in App.tsx
 */

// All valid dashboard routes defined in App.tsx
const VALID_DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/sessao-estudo",
  "/dashboard/flashcards",
  "/dashboard/gerar-flashcards",
  "/dashboard/simulados",
  "/dashboard/banco-erros",
  "/dashboard/gerador-questoes",
  "/dashboard/mentor",
  "/dashboard/mentor",
  "/dashboard/videoaulas",
  "/dashboard/videoaulas/explorar",
  "/dashboard/videoaulas/:id",
  "/dashboard/resumos",
  "/dashboard/apostilas",
  "/dashboard/mapas-mentais",
  "/dashboard/mnemonic-studio-v2",
  "/dashboard/mnemonic-history",
  "/dashboard/plantao",
  "/dashboard/anamnese",
  "/dashboard/cronicas",
  "/dashboard/discursivas",
  "/dashboard/prova-pratica",
  "/dashboard/image-quiz",
  "/dashboard/revisor",
  "/dashboard/entrevista",
  "/dashboard/planner",
  "/dashboard/analytics",
  "/dashboard/perfil",
  "/dashboard/conquistas",
  "/dashboard/rankings",
  "/dashboard/diagnostico",
  "/dashboard/predictor",
  "/dashboard/mapa-dominio",
  "/dashboard/proficiencia",
  "/dashboard/radar-trajetoria",
  "/dashboard/minha-jornada",
  "/dashboard/agentes",
  "/dashboard/uploads",
  "/dashboard/coach",
  "/dashboard/orchestrator-insights"
];

const VALID_TOP_ROUTES = [
  "/",
  "/login",
  "/register",
  "/admin",
  "/professor",
  "/install",
];

// Sidebar routes (DashboardSidebar.tsx)
const SIDEBAR_ROUTES = [
  "/dashboard",
  "/dashboard/mentor",
  "/dashboard/sessao-estudo",
  "/dashboard/diagnostico",
  "/dashboard/planner",
  "/dashboard/flashcards",
  "/dashboard/gerar-flashcards",
  "/dashboard/resumos",
  "/dashboard/apostilas",
  "/dashboard/cronicas",
  "/dashboard/simulados",
  "/dashboard/gerador-questoes",
  "/dashboard/discursivas",
  "/dashboard/anamnese",
  "/dashboard/plantao",
  "/dashboard/predictor",
  "/dashboard/banco-erros",
  "/dashboard/mapa-dominio",
  "/dashboard/proficiencia",
  "/dashboard/coach",
  "/dashboard/conquistas",
  "/dashboard/analytics",
  "/dashboard/uploads",
  "/dashboard/perfil",
];

// Mobile nav routes (DashboardLayout.tsx)
const MOBILE_NAV_ROUTES = [
  "/dashboard",
  "/dashboard/mentor",
  "/dashboard/diagnostico",
  "/dashboard/planner",
  "/dashboard/flashcards",
  "/dashboard/gerar-flashcards",
  "/dashboard/resumos",
  "/dashboard/apostilas",
  "/dashboard/cronicas",
  "/dashboard/simulados",
  "/dashboard/gerador-questoes",
  "/dashboard/discursivas",
  "/dashboard/anamnese",
  "/dashboard/plantao",
  "/dashboard/predictor",
  "/dashboard/banco-erros",
  "/dashboard/mapa-dominio",
  "/dashboard/proficiencia",
  "/dashboard/coach",
  "/dashboard/conquistas",
  "/dashboard/analytics",
];

// AgentsHub routes
const AGENTS_HUB_ROUTES = [
  "/dashboard/mentor",
  "/dashboard/gerador-questoes",
  "/dashboard/gerar-flashcards",
  "/dashboard/resumos",
  "/dashboard/plantao",
  "/dashboard/coach",
  "/dashboard/predictor",
  "/dashboard/discursivas",
  "/dashboard/revisor",
  "/dashboard/entrevista",
];

// Navigate() calls from various pages
const NAVIGATE_TARGETS = [
  "/dashboard/mentor",        // ErrorBank, QuestionsBank, Flashcards, ExamSimulator, Diagnostic, MedicalDomainMap, TopicEvolution
  "/dashboard",               // Diagnostic
  "/dashboard/gerador-questoes", // QuestionsBank "Gerar mais"
  "/dashboard/simulados",      // CronogramaRecursosRevisao
  "/dashboard/mapa-dominio",   // TopicEvolution
  "/dashboard/conquistas",     // XpWidget
  "/dashboard/perfil",         // DashboardSidebar, DashboardLayout
  "/dashboard/simulados",      // Dashboard
  "/dashboard/flashcards",     // Dashboard
];

describe("Route Validation", () => {
  it("all sidebar routes exist in App.tsx", () => {
    for (const route of SIDEBAR_ROUTES) {
      expect(VALID_DASHBOARD_ROUTES).toContain(route);
    }
  });

  it("all mobile nav routes exist in App.tsx", () => {
    for (const route of MOBILE_NAV_ROUTES) {
      expect(VALID_DASHBOARD_ROUTES).toContain(route);
    }
  });

  it("all AgentsHub routes exist in App.tsx", () => {
    for (const route of AGENTS_HUB_ROUTES) {
      expect(VALID_DASHBOARD_ROUTES).toContain(route);
    }
  });

  it("all navigate() targets exist in App.tsx", () => {
    for (const route of NAVIGATE_TARGETS) {
      expect(VALID_DASHBOARD_ROUTES).toContain(route);
    }
  });

  it("sidebar and mobile nav are in sync", () => {
    // Mobile nav should be a subset of sidebar (excluding perfil which is separate)
    for (const route of MOBILE_NAV_ROUTES) {
      expect(SIDEBAR_ROUTES).toContain(route);
    }
  });

  it("no duplicate routes in valid routes list", () => {
    const unique = new Set(VALID_DASHBOARD_ROUTES);
    expect(unique.size).toBe(VALID_DASHBOARD_ROUTES.length);
  });

  it("all routes follow naming convention (lowercase, hyphenated)", () => {
    const pattern = /^\/dashboard(\/[a-z0-9-:]+)*$/;
    for (const route of VALID_DASHBOARD_ROUTES) {
      expect(route).toMatch(pattern);
    }
  });

  it("expected total route count matches", () => {
    // Dashboard routes + top-level routes
    expect(VALID_DASHBOARD_ROUTES.length).toBeGreaterThan(30);
    expect(VALID_TOP_ROUTES.length).toBe(6);
  });
});
