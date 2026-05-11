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
  LayoutDashboard, Users, BookOpenCheck, FileQuestion, FileText,
  Image as ImageIcon, MessageSquare, Bell, MessageCircleHeart, Bot,
  Settings2, Flag, KeyRound, Plug, Cpu,
  Workflow, Server, Activity, Wrench, Network, BrainCircuit,
  ClipboardList, Sparkles, DollarSign, ShieldCheck, Database
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
        label: "Alunos",
        description: "Painel do mentor: alunos em risco, progresso e intervenções.",
        icon: Users,
        scopes: ["super_admin", "admin_pedagogico", "admin_operacional"],
        keywords: ["mentor", "alunos", "risco", "engajamento"],
      },
      {
        to: "/admin?tab=audit",
        label: "Auditoria",
        description: "Log de todas as ações administrativas e mudanças sensíveis.",
        icon: ClipboardList,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["log", "audit", "histórico"],
      },
      {
        to: "/admin?tab=features",
        label: "Governança",
        description: "Configuração de thresholds e limites operacionais enterprise.",
        icon: Settings2,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["governança", "settings", "thresholds", "limites"],
      },
      {
        to: "/admin/audit",
        label: "Integridade",
        description: "Auditoria técnica de pipeline de dados e gaps de telemetria.",
        icon: ShieldCheck,
        scopes: ["super_admin", "devops"],
        keywords: ["integridade", "audit", "gaps", "dados"],
      },
    ],
  },
  {
    id: "conteudo",
    label: "Conteúdo",
    icon: BookOpenCheck,
    description: "Curadoria de aulas, banco de questões e biblioteca.",
    items: [
      {
        to: "/admin/users?tab=uploads",
        label: "Upload de Arquivos",
        description: "Upload de materiais brutos, PDFs e provas para o sistema.",
        icon: FileText,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["upload", "arquivo", "pdf", "bruto"],
      },
      {
        to: "/admin/lessons-memory",
        label: "Curadoria de Aulas",
        description: "Memória de aulas do Tutor IA — estruturação, vídeo e publicação.",
        icon: BookOpenCheck,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["aulas", "tutor", "memória", "lessons", "ingestion"],
      },
      {
        to: "/admin/users?tab=lesson-ratings",
        label: "Avaliações",
        description: "Analytics de satisfação cinematográfica das videoaulas.",
        icon: Sparkles,
        scopes: ["super_admin", "admin_pedagogico"],
        badge: "Novo",
        keywords: ["avaliação", "rating", "star", "satisfação"],
      },
      {
        to: "/admin?tab=knowledge-base",
        label: "Base RAG",
        description: "Repositório de materiais da instituição para o Tutor IA.",
        icon: Database,
        scopes: ["super_admin", "admin_pedagogico", "admin_operacional"],
        keywords: ["rag", "base de conhecimento", "materiais", "pdf", "biblioteca"],
      },
      {
        to: "/admin/users?tab=ingestion",
        label: "Gerar Questões",
        description: "Pipeline de IA para geração de questões a partir de PDF/Texto.",
        icon: Sparkles,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["gerar", "questões", "ai", "ingestion"],
      },
      {
        to: "/admin/users?tab=question-review",
        label: "Aprovar Questões",
        description: "Painel de curadoria para aprovação de questões geradas.",
        icon: BookOpenCheck,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["aprovar", "questões", "revisão"],
      },
      {
        to: "/admin/users?tab=image-review",
        label: "Aprovar Imagens",
        description: "Curadoria visual de questões com imagens.",
        icon: ImageIcon,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["imagem", "fotos", "review"],
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
        label: "Simulados",
        description: "Cobertura de bancas, prontidão e telemetria de simulados.",
        icon: FileText,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["simulado", "banca", "prova"],
      },
      {
        to: "/admin/video-lessons",
        label: "Biblioteca",
        description: "Vídeos publicados, materiais e ativos pedagógicos.",
        icon: ImageIcon,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["vídeo", "videoaulas", "biblioteca", "ativos"],
      },
    ],
  },
  {
    id: "comunidade",
    label: "Comunidade",
    icon: MessageSquare,
    description: "Usuários, mensagens e feedbacks.",
    items: [
      {
        to: "/admin/users",
        label: "Usuários",
        description: "Gestão de contas, planos, bloqueios e aprovações.",
        icon: Users,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["users", "contas", "alunos", "plano"],
      },
      {
        to: "/admin/telemetry",
        label: "Telemetria",
        description: "Dashboards de engajamento, funil e comportamento real.",
        icon: Activity,
        scopes: ["super_admin", "admin_operacional", "admin_pedagogico"],
        keywords: ["telemetria", "funil", "comportamento", "analytics"],
      },
      {
        to: "/admin/users?tab=broadcast",
        label: "Mensagens",
        description: "Sistema de notificações e alertas em massa.",
        icon: Bell,
        scopes: ["super_admin", "admin_operacional"],
        keywords: ["notificação", "alerta", "broadcast"],
      },
      {
        to: "/admin/specialty-friction",
        label: "Feedbacks",
        description: "Atrito por especialidade e relatórios qualitativos.",
        icon: MessageCircleHeart,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["feedback", "friction", "qualidade"],
      },
    ],
  },
  {
    id: "inteligencia",
    label: "IA",
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
        to: "/admin/tutor-video-recommendations",
        label: "Recomendações Tutor",
        description: "Auditoria de recomendações de videoaulas automáticas.",
        icon: Activity,
        scopes: ["super_admin", "admin_pedagogico"],
        keywords: ["tutor", "video", "recomendações", "cliques", "analytics"],
      },
      {
        to: "/admin/ai-studio",
        label: "Prompts",
        description: "Central de produção de conteúdo IA e prompts.",
        icon: Settings2,
        scopes: ["super_admin"],
        keywords: ["prompt", "studio", "ia", "geração"],
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
        to: "/admin#roles",
        label: "Permissões",
        description: "Gestão de roles e escopos administrativos.",
        icon: KeyRound,
        scopes: ["super_admin"],
        keywords: ["role", "permission", "rbac"],
      },
      {
        to: "/admin/intervention-policies",
        label: "Feature Flags",
        description: "Políticas de intervenção e flags de funcionalidades.",
        icon: Flag,
        scopes: ["super_admin"],
        keywords: ["flag", "policy", "toggle"],
      },
      {
        to: "/admin/notebooklm",
        label: "Integrações",
        description: "Conectores externos (NotebookLM, Stripe, etc).",
        icon: Plug,
        scopes: ["super_admin"],
        keywords: ["integration", "connector", "external"],
      },
    ],
  },
  {
    id: "laboratorio",
    label: "Laboratório",
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
        to: "/admin/cme-incidents",
        label: "Logs técnicos",
        description: "Incidentes, alertas e postmortems.",
        icon: Activity,
        scopes: ["devops", "super_admin"],
        keywords: ["incident", "alert", "ops", "logs"],
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