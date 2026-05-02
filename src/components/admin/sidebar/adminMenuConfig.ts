/**
 * adminMenuConfig — fonte única de verdade para o menu do AdminSidebarEnterprise.
 *
 * Cada item declara:
 *  - to:          rota (mantém todas as rotas legadas funcionando)
 *  - label:       texto exibido (em pt-BR, sem jargão técnico)
 *  - description: tooltip / descrição na busca
 *  - icon:        Lucide icon
 *  - scopes:      escopos que podem ver o item (ver useAdminScope)
 *  - badge?:      rótulo opcional (ex: "Beta", "Legado")
 *
 * Categorias (ordem):
 *   1. Centro de Comando
 *   2. Gestão de Conteúdo
 *   3. Comunidade & Suporte
 *   4. Inteligência ENA
 *   5. Sistema
 *   6. Laboratório Técnico  (oculto para não-devops)
 */
import {
  LayoutDashboard, Users, ShieldCheck, BookOpenCheck, FileQuestion, FileText,
  Image as ImageIcon, Upload, MessageSquare, Bell, MessageCircleHeart, Bot,
  Settings2, GitBranch, DollarSign, Flag, KeyRound, Plug, HardDrive, Cpu,
  Workflow, Server, Activity, Wrench, Stethoscope, BarChart3, BrainCircuit,
  ClipboardList, Network, Eye, Layers, Sparkles,
} from "lucide-react";
import type { AdminScope } from "@/hooks/useAdminScope";

export interface AdminMenuItem {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  scopes: AdminScope[];
  badge?: "Beta" | "Legado" | "Novo" | "Dev";
  /** Termos extras para a busca global (sinônimos, abreviações, IDs antigos) */
  keywords?: string[];
}

export interface AdminMenuCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  items: AdminMenuItem[];
  /** Categorias visíveis somente para certos escopos (default: todos com hasAny) */
  scopes?: AdminScope[];
}

export const ADMIN_MENU: AdminMenuCategory[] = [
  {
    id: "comando",
    label: "Centro de Comando",
    icon: LayoutDashboard,
    description: "Visão executiva consolidada do produto, alunos e operação.",
    items: [
      {
        to: "/admin",
        label: "Dashboard Executivo",
        description: "KPIs unificados de negócio, alunos, IA, custos e incidentes.",
        icon: LayoutDashboard,
        scopes: ["super_admin", "admin_operacional", "admin_pedagogico"],
        keywords: ["centro de comando", "ceo", "kpi", "executivo"],
      },
      {
        to: "/admin/monitoring",
        label: "Monitor de Alunos",
        description: "Painel do mentor: alunos em risco, progresso e intervenções.",
        icon: Users,
        scopes: ["super_admin", "admin_pedagogico", "admin_operacional"],
        keywords: ["mentor", "alunos", "risco", "engajamento"],
      },
      {
        to: "/admin/ai-audit-mode",
        label: "Auditoria de Ações",
        description: "Log de todas as ações administrativas e mudanças sensíveis.",
        icon: ClipboardList,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["log", "audit", "histórico"],
      },
    ],
  },
  {
    id: "conteudo",
    label: "Gestão de Conteúdo",
    icon: BookOpenCheck,
    description: "Curadoria de aulas, banco de questões e biblioteca.",
    items: [
      {
        to: "/admin/lessons-memory",
        label: "Curadoria de Aulas",
        description: "Memória de aulas do Tutor IA — estruturação, vídeo e publicação.",
        icon: BookOpenCheck,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["aulas", "tutor", "memória", "lessons", "ingestion"],
      },
      {
        to: "/admin/medical-review-queue",
        label: "Banco de Questões",
        description: "Fila de revisão pedagógica e governança médica.",
        icon: FileQuestion,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["questões", "review", "queue"],
      },
      {
        to: "/admin/banca-readiness",
        label: "Simulados & Provas",
        description: "Cobertura de bancas, prontidão e telemetria de simulados.",
        icon: FileText,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["simulado", "banca", "prova"],
      },
      {
        to: "/admin/video-lessons",
        label: "Biblioteca de Ativos",
        description: "Vídeos publicados, materiais e ativos pedagógicos.",
        icon: ImageIcon,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["vídeo", "videoaulas", "biblioteca", "ativos"],
      },
      {
        to: "/admin/ingestion-provas",
        label: "Importação de Conteúdo",
        description: "Ingestão de provas oficiais e bancos externos.",
        icon: Upload,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["import", "ingestion", "provas oficiais"],
      },
    ],
  },
  {
    id: "comunidade",
    label: "Comunidade & Suporte",
    icon: MessageSquare,
    description: "Usuários, mensagens e feedbacks.",
    items: [
      {
        to: "/admin#users",
        label: "Usuários",
        description: "Gestão de contas, planos, bloqueios e aprovações.",
        icon: Users,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["users", "contas", "alunos", "plano"],
      },
      {
        to: "/admin/telemetry",
        label: "Mensagens & Alertas",
        description: "Sistema de notificações e alertas em massa.",
        icon: Bell,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["notificação", "alerta", "broadcast"],
      },
      {
        to: "/admin/specialty-friction",
        label: "Feedbacks dos Alunos",
        description: "Atrito por especialidade e relatórios qualitativos.",
        icon: MessageCircleHeart,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["feedback", "friction", "qualidade"],
      },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência ENA",
    icon: BrainCircuit,
    description: "Tutor IA, motor adaptativo e custos.",
    items: [
      {
        to: "/admin/tutor-memory",
        label: "Tutor IA",
        description: "Memória semântica e cenários do Tutor.",
        icon: Bot,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["tutor", "memory", "rag", "embeddings"],
      },
      {
        to: "/admin/ai-studio",
        label: "Configurações IA",
        description: "Central de produção de conteúdo IA e prompts.",
        icon: Settings2,
        scopes: ["super_admin"],
        keywords: ["prompt", "studio", "ia", "geração"],
      },
      {
        to: "/admin/adaptive-engine",
        label: "Motor Adaptativo",
        description: "Regras, políticas e experimentos do ACE Loop.",
        icon: GitBranch,
        scopes: ["super_admin"],
        keywords: ["ace", "adaptive", "engine", "policies"],
      },
      {
        to: "/admin/medical-governance",
        label: "Custos IA",
        description: "Métricas de custo, qualidade e BI multimodal.",
        icon: DollarSign,
        scopes: ["super_admin"],
        keywords: ["custo", "billing", "bi", "qualidade"],
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings2,
    description: "Feature flags, permissões, integrações e storage.",
    scopes: ["super_admin"],
    items: [
      {
        to: "/admin/intervention-policies",
        label: "Feature Flags",
        description: "Políticas de intervenção e flags de funcionalidades.",
        icon: Flag,
        scopes: ["super_admin"],
        keywords: ["flag", "policy", "toggle"],
      },
      {
        to: "/admin#roles",
        label: "Permissões & Papéis",
        description: "Gestão de roles e escopos administrativos.",
        icon: KeyRound,
        scopes: ["super_admin"],
        keywords: ["role", "permission", "rbac"],
      },
      {
        to: "/admin/notebooklm",
        label: "Integrações",
        description: "Conectores externos (NotebookLM, Stripe, etc).",
        icon: Plug,
        scopes: ["super_admin"],
        keywords: ["integration", "connector", "external"],
      },
      {
        to: "/admin/cme-media-monitor",
        label: "Storage",
        description: "Saúde de buckets, mídias e ativos hospedados.",
        icon: HardDrive,
        scopes: ["super_admin"],
        keywords: ["storage", "bucket", "asset"],
      },
    ],
  },
  {
    id: "laboratorio",
    label: "Laboratório Técnico",
    icon: Wrench,
    description: "Áreas avançadas de DevOps e infraestrutura.",
    scopes: ["devops", "super_admin"],
    items: [
      {
        to: "/admin/cme-executive",
        label: "CME / GPU",
        description: "Fábrica de vídeos cinematográficos e GPU fleet.",
        icon: Cpu,
        scopes: ["devops", "super_admin"],
        keywords: ["cme", "gpu", "render", "video"],
      },
      {
        to: "/admin/gpu-fleet",
        label: "Workers",
        description: "Orquestração de workers GPU.",
        icon: Server,
        scopes: ["devops", "super_admin"],
        keywords: ["worker", "fleet", "gpu"],
      },
      {
        to: "/admin/render-queues",
        label: "Render Queue",
        description: "Filas de renderização distribuída.",
        icon: Workflow,
        scopes: ["devops", "super_admin"],
        keywords: ["render", "queue", "fila"],
      },
      {
        to: "/admin/orchestrator-insights",
        label: "AI Router",
        description: "Roteamento de modelos IA e insights do orquestrador.",
        icon: Network,
        scopes: ["devops", "super_admin"],
        keywords: ["router", "orchestrator", "ai"],
      },
      {
        to: "/admin/cme-incidents",
        label: "Incident Ops",
        description: "Incidentes, alertas e postmortems.",
        icon: Activity,
        scopes: ["devops", "super_admin"],
        keywords: ["incident", "alert", "ops"],
      },
      {
        to: "/admin/system-checklist",
        label: "Ferramentas DEV",
        description: "Checklist de sistema, telemetria e diagnósticos.",
        icon: Wrench,
        scopes: ["devops", "super_admin"],
        keywords: ["dev", "tools", "diagnostic", "checklist"],
        badge: "Dev",
      },
    ],
  },
];

/** Filtra menu por escopo do usuário, removendo categorias vazias. */
export const filterMenuByScopes = (
  scopes: AdminScope[],
): AdminMenuCategory[] => {
  return ADMIN_MENU.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) =>
      item.scopes.some((s) => scopes.includes(s)),
    ),
  })).filter((cat) => {
    if (cat.scopes && !cat.scopes.some((s) => scopes.includes(s))) return false;
    return cat.items.length > 0;
  });
};

/** Busca textual em todos os itens (nome, descrição, keywords). */
export const searchMenu = (
  scopes: AdminScope[],
  query: string,
): AdminMenuItem[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = filterMenuByScopes(scopes).flatMap((c) => c.items);
  return all
    .filter((item) => {
      const hay = [
        item.label,
        item.description,
        ...(item.keywords || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 10);
};
