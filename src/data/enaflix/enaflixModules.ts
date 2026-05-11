/**
 * Enaflix — Catálogo de módulos.
 *
 * Fonte única para o hub visual. Cada item aponta para uma rota REAL existente
 * em src/App.tsx. Itens sem rota ficam como "Em breve".
 *
 * Para adicionar um módulo no Enaflix: inclua aqui (não espalhe pelo código).
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  ClipboardList,
  Cpu,
  Crown,
  Dumbbell,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  HeartPulse,
  History,
  Image as ImageIcon,
  Layers,
  Library,
  LineChart,
  ListChecks,
  MapPin,
  MessagesSquare,
  Mic,
  Network,
  PenLine,
  Radar,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Trophy,
  Users,
  UserCheck,
  Wand2,
  Zap,
  Video,
  Upload,
} from "lucide-react";

import type { EnaflixCategoryId } from "./enaflixCategories";

export type EnaflixBadge =
  | "novo"
  | "ia"
  | "recomendado"
  | "em-alta"
  | "urgente"
  | "premium"
  | "em-breve";

export interface EnaflixModule {
  id: string;
  title: string;
  description: string;
  /** Rota real do React Router. Se ausente → "Em breve". */
  route?: string;
  category: EnaflixCategoryId;
  icon: LucideIcon;
  badge?: EnaflixBadge;
  /** Termos extras para a busca */
  keywords?: string[];
  /** Restringe visibilidade por role */
  requires?: "admin" | "professor";
  /** Esconde sem remover (ex.: módulo desativado) */
  enabled?: boolean;
  /** Aparece em "Recomendados" mesmo sem heurística */
  featured?: boolean;
  /** Tom de gradiente para o card (HSL via design tokens) */
  accent?: "primary" | "warning" | "success" | "destructive" | "info" | "purple" | "pink";
}

export const ENAFLIX_MODULES: EnaflixModule[] = [
  // ───────── AVALIAÇÃO ─────────
  {
    id: "simulados",
    title: "Simulados",
    description: "Provas completas no estilo das principais bancas",
    route: "/dashboard/simulados",
    category: "avaliacao",
    icon: ClipboardList,
    badge: "em-alta",
    keywords: ["prova", "exame", "enare", "usp", "banca"],
    accent: "primary",
    featured: true,
  },
  {
    id: "diagnostico",
    title: "Diagnóstico",
    description: "Descubra seu nível atual em minutos",
    route: "/dashboard/diagnostico",
    category: "avaliacao",
    icon: Gauge,
    accent: "info",
    keywords: ["nivelamento", "avaliação inicial"],
  },
  {
    id: "discursivas",
    title: "Discursivas",
    description: "Treine respostas escritas com correção por IA",
    route: "/dashboard/discursivas",
    category: "avaliacao",
    icon: PenLine,
    badge: "ia",
    accent: "purple",
  },
  {
    id: "prova-pratica",
    title: "Prova Prática (OSCE)",
    description: "Estações simuladas com pressão de tempo",
    route: "/dashboard/prova-pratica",
    category: "avaliacao",
    icon: Stethoscope,
    accent: "destructive",
  },
  {
    id: "predictor",
    title: "Chance de Aprovação",
    description: "Radar preditivo da sua nota nas principais bancas",
    route: "/dashboard/predictor",
    category: "avaliacao",
    icon: TrendingUp,
    badge: "ia",
    accent: "info",
    keywords: ["predictor", "previsão", "probabilidade", "enare", "radar", "usp", "mais-cobrados"],
  },

  // ───────── TREINO & REVISÃO ─────────
  {
    id: "sessao-estudo",
    title: "Sessão de Estudo",
    description: "Centro pedagógico — questões, revisão e tutor",
    route: "/dashboard/sessao-estudo",
    category: "treino",
    icon: Rocket,
    badge: "recomendado",
    accent: "primary",
    featured: true,
  },
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Repetição espaçada com FSRS",
    route: "/dashboard/flashcards",
    category: "treino",
    icon: Layers,
    accent: "warning",
  },
  {
    id: "gerar-flashcards",
    title: "Gerar Flashcards",
    description: "Crie cartões a partir de qualquer tema",
    route: "/dashboard/gerar-flashcards",
    category: "treino",
    icon: Wand2,
    badge: "ia",
    accent: "purple",
  },
  {
    id: "banco-erros",
    title: "Banco de Erros",
    description: "Revise exatamente o que você errou",
    route: "/dashboard/banco-erros",
    category: "treino",
    icon: AlertTriangle,
    badge: "urgente",
    accent: "destructive",
  },
  {
    id: "mnemonico",
    title: "Mnemônicos",
    description: "Memorização visual cinematográfica",
    route: "/dashboard/mnemonico",
    category: "treino",
    icon: Brain,
    badge: "premium",
    accent: "pink",
    keywords: ["memorização", "associação"],
  },
  {
    id: "mapas-mentais",
    title: "Mapas Mentais",
    description: "Estruture conhecimento em árvores visuais",
    route: "/dashboard/mapas-mentais",
    category: "treino",
    icon: Network,
    accent: "info",
  },
  {
    id: "questoes",
    title: "Gerador de Questões",
    description: "Gere questões personalizadas por tema",
    route: "/dashboard/gerador-questoes",
    category: "treino",
    icon: Sparkles,
    badge: "ia",
    accent: "purple",
  },

  // ───────── CLÍNICA & SIMULAÇÃO ─────────
  {
    id: "anamnese",
    title: "Treino de Anamnese",
    description: "Pratique a coleta semiológica com paciente IA",
    route: "/dashboard/anamnese",
    category: "clinica",
    icon: Mic,
    badge: "ia",
    accent: "primary",
  },
  {
    id: "plantao",
    title: "Modo Plantão",
    description: "Simulação clínica em tempo real",
    route: "/dashboard/plantao",
    category: "clinica",
    icon: HeartPulse,
    badge: "em-alta",
    accent: "destructive",
  },
  {
    id: "cronicas",
    title: "Crônicas Médicas",
    description: "Casos longitudinais narrativos",
    route: "/dashboard/cronicas",
    category: "clinica",
    icon: ScrollText,
    accent: "warning",
  },
  {
    id: "image-quiz",
    title: "Quiz de Imagens",
    description: "Habilidade visual: ECG, RX, lâminas",
    route: "/dashboard/image-quiz",
    category: "clinica",
    icon: ImageIcon,
    accent: "info",
  },
  {
    id: "entrevista",
    title: "Entrevista de Residência",
    description: "Treine respostas com banca simulada",
    route: "/dashboard/entrevista",
    category: "clinica",
    icon: Briefcase,
    accent: "purple",
  },

  // ───────── VIDEOAULAS ─────────
  {
    id: "videoaulas",
    title: "Videoaulas",
    description: "Biblioteca cinematográfica de videoaulas IA",
    route: "/dashboard/videoaulas",
    category: "videoaulas",
    icon: Video,
    badge: "ia",
    accent: "primary",
    featured: true,
    keywords: ["vídeo", "aula", "cinema", "multimodal", "tutor", "cme"],
  },

  // ───────── CONTEÚDO & ESTUDO ─────────
  {
    id: "apostilas",
    title: "Apostilas & Resumos",
    description: "Material de estudo curado",
    route: "/dashboard/apostilas",
    category: "conteudo",
    icon: Library,
    accent: "primary",
  },
  {
    id: "revisor",
    title: "Revisor Médico",
    description: "Validação clínica e citação de fontes",
    route: "/dashboard/revisor",
    category: "conteudo",
    icon: ShieldCheck,
    accent: "success",
  },
  {
    id: "mentor",
    title: "Tutor IA",
    description: "Tutor, Mentor, Revisão e Estratégia ENARE em um só lugar",
    route: "/dashboard/sessao-estudo",
    category: "conteudo",
    icon: Brain,
    badge: "ia",
    accent: "primary",
    featured: true,
    keywords: ["tutor", "mentor", "estratégia", "enare", "dúvida", "chat", "v2"],
  },

  // ───────── PROGRESSO & ESTRATÉGIA ─────────
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Visão geral do seu progresso",
    route: "/dashboard",
    category: "progresso",
    icon: Activity,
    accent: "primary",
  },
  {
    id: "minhas-aulas",
    title: "Minhas Aulas",
    description: "Sua memória educacional centralizada",
    route: "/dashboard/videoaulas",
    category: "progresso",
    icon: History,
    badge: "novo",
    accent: "success",
    featured: true,
  },
  {
    id: "favoritos",
    title: "Favoritos",
    description: "Seus conteúdos salvos para revisão rápida",
    route: "/dashboard/favoritos",
    category: "progresso",
    icon: HeartPulse,
    accent: "pink",
  },
  {
    id: "historico",
    title: "Histórico",
    description: "Tudo o que você já estudou no ENAZIZI",
    route: "/dashboard/historico",
    category: "progresso",
    icon: History,
    accent: "info",
  },
  {
    id: "planner",
    title: "Planner IA",
    description: "Cronograma estratégico personalizado",
    route: "/dashboard/planner",
    category: "progresso",
    icon: Calendar,
    badge: "ia",
    accent: "info",
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Métricas detalhadas do seu desempenho",
    route: "/dashboard/analytics",
    category: "progresso",
    icon: BarChart3,
    accent: "purple",
  },
  {
    id: "radar",
    title: "Radar de Trajetória",
    description: "Sua aprovação por banca",
    route: "/dashboard/radar-trajetoria",
    category: "progresso",
    icon: Radar,
    badge: "novo",
    accent: "info",
  },
  {
    id: "mapa-dominio",
    title: "Mapa de Domínio",
    description: "Evolução por especialidade",
    route: "/dashboard/mapa-dominio",
    category: "progresso",
    icon: MapPin,
    accent: "success",
  },
  {
    id: "proficiencia",
    title: "Proficiência",
    description: "Provas atribuídas e desempenho",
    route: "/dashboard/proficiencia",
    category: "progresso",
    icon: GraduationCap,
    accent: "warning",
  },

  // ───────── GAMIFICAÇÃO ─────────
  {
    id: "conquistas",
    title: "Conquistas",
    description: "Badges, troféus e marcos",
    route: "/dashboard/conquistas",
    category: "gamificacao",
    icon: Trophy,
    accent: "warning",
  },
  {
    id: "rankings",
    title: "Rankings",
    description: "Compare seu desempenho com a comunidade",
    route: "/dashboard/rankings",
    category: "gamificacao",
    icon: Crown,
    accent: "warning",
  },
  {
    id: "missao",
    title: "Modo Missão",
    description: "Foco total — uma missão por vez",
    route: "/mission",
    category: "gamificacao",
    icon: Target,
    badge: "em-alta",
    accent: "destructive",
  },

  // ───────── FERRAMENTAS INTELIGENTES ─────────
  {
    id: "agentes",
    title: "Agentes",
    description: "Hub de agentes especialistas",
    route: "/dashboard/agentes",
    category: "ferramentas",
    icon: Cpu,
    accent: "purple",
  },
  {
    id: "perfil",
    title: "Meu Espaço",
    description: "Conta, preferências e configurações",
    route: "/dashboard/perfil",
    category: "ferramentas",
    icon: Settings,
    accent: "primary",
    keywords: ["perfil", "minha conta", "configurações", "preferências"],
  },

  // ───────── PROFESSOR ─────────
  {
    id: "professor",
    title: "Painel do Professor",
    description: "Turmas, atribuições e mentoria",
    route: "/professor",
    category: "professor",
    icon: GraduationCap,
    requires: "professor",
    accent: "primary",
  },

  // ───────── ADMINISTRAÇÃO ─────────
  {
    id: "admin",
    title: "Admin Hub",
    description: "Painel administrativo geral",
    route: "/admin",
    category: "admin",
    icon: Shield,
    requires: "admin",
    accent: "destructive",
  },
  {
    id: "admin-monitoring",
    title: "Monitoramento",
    description: "Saúde do sistema em tempo real",
    route: "/admin/monitoring",
    category: "admin",
    icon: Activity,
    requires: "admin",
    accent: "info",
  },
  {
    id: "admin-users",
    title: "Usuários",
    description: "Gestão de alunos e permissões",
    route: "/admin?tab=users-all",
    category: "admin",
    icon: Users,
    requires: "admin",
    accent: "primary",
  },
  {
    id: "admin-uploads",
    title: "Upload de Arquivos",
    description: "Central de ingestão de PDFs e mídias",
    route: "/admin?tab=uploads",
    category: "admin",
    icon: Upload,
    requires: "admin",
    accent: "warning",
  },
  {
    id: "admin-ingestion",
    title: "Gerar Questões",
    description: "IA para extração e criação de questões",
    route: "/admin?tab=ingestion",
    category: "admin",
    icon: Sparkles,
    requires: "admin",
    accent: "purple",
  },
  {
    id: "admin-review",
    title: "Aprovar Questões",
    description: "Curadoria técnica de conteúdo gerado",
    route: "/admin?tab=question-review",
    category: "admin",
    icon: UserCheck,
    requires: "admin",
    accent: "success",
  },
  {
    id: "admin-classifier",
    title: "Classificador IA",
    description: "Runner, saúde, aliases, queue e snapshots",
    route: "/admin/classification-health",
    category: "admin",
    icon: LineChart,
    requires: "admin",
    badge: "novo",
    accent: "success",
    keywords: ["classificador", "runner", "health", "aliases", "queue", "snapshots", "rollback"],
  },
  {
    id: "admin-coverage",
    title: "Cobertura de Conteúdo",
    description: "Auditoria do banco curricular",
    route: "/admin/coverage",
    category: "admin",
    icon: BookOpen,
    requires: "admin",
    accent: "purple",
  },
  {
    id: "admin-ceo",
    title: "CEO Dashboard",
    description: "Métricas de negócio e produto",
    route: "/admin/ceo",
    category: "admin",
    icon: Award,
    requires: "admin",
    accent: "primary",
  },
];

export function getModuleById(id: string): EnaflixModule | undefined {
  return ENAFLIX_MODULES.find((m) => m.id === id);
}
