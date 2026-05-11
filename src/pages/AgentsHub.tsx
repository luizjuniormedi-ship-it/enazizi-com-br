import { Sparkles, HelpCircle, BookOpen, Heart, Activity, FlipVertical, MessageCircle, Brain } from "lucide-react";
import { CinematicHero } from "@/components/cinematic";
import { AgentPosterCard, type AgentAccent } from "@/components/agents/AgentPosterCard";
import { AgentSpotlight, type SpotlightAgent } from "@/components/agents/AgentSpotlight";

interface AgentDef {
  to: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  accent: AgentAccent;
  isNew?: boolean;
  highlight?: boolean;
  badge?: string;
  category: "ensino" | "treino" | "memoria" | "suporte";
}

const AGENTS: AgentDef[] = [
  {
    to: "/dashboard/sessao-estudo",
    icon: Sparkles,
    title: "Tutor IA V2 — Nova Geração",
    description:
      "Arquitetura limpa integrada ao ecossistema ENAZIZI. Médico, pedagógico, adaptativo e rastreável. Integrado ao Planner, FSRS e Error Bank.",
    accent: "violet",
    highlight: true,
    badge: "Nova Geração",
    category: "ensino",
  },
  {
    to: "/dashboard/sessao-estudo",
    icon: Sparkles,
    title: "Tutor IA — Mentor Principal",
    description:
      "Seu professor particular. Aulas pelo Protocolo ENAZIZI: explicação → fisiopatologia → clínica → questões → caso discursivo.",
    accent: "success",
    category: "ensino",
  },
  {
    to: "/dashboard/resumos",
    icon: BookOpen,
    title: "Resumidor de Conteúdo",
    description:
      "Resumos estruturados com tabelas comparativas, mnemônicos e pegadinhas de prova. Ideal para revisão rápida antes da banca.",
    accent: "success",
    category: "ensino",
  },
  {
    to: "/dashboard/cronicas",
    icon: BookOpen,
    title: "Crônicas Médicas",
    description:
      "Aprenda medicina por narrativas clínicas imersivas. Você é o médico no plantão — raciocine, decida e aprenda com casos cinematográficos.",
    accent: "amber",
    isNew: true,
    category: "ensino",
  },
  {
    to: "/dashboard/questoes",
    icon: HelpCircle,
    title: "Gerador de Questões",
    description:
      "Questões objetivas estilo ENARE/USP com casos clínicos, gabarito comentado e referências. Treine padrões reais de prova.",
    accent: "warning",
    category: "treino",
  },
  {
    to: "/dashboard/plantao",
    icon: Activity,
    title: "Modo Plantão",
    description:
      "Simulação interativa de atendimento clínico. Atenda pacientes virtuais, tome decisões e receba avaliação em tempo real.",
    accent: "destructive",
    category: "treino",
  },
  {
    to: "/dashboard/anamnese",
    icon: MessageCircle,
    title: "Treino de Anamnese",
    description:
      "Pratique entrevista clínica com pacientes simulados. A IA só responde ao que você perguntar — treine sua técnica semiológica.",
    accent: "teal",
    isNew: true,
    category: "treino",
  },
  {
    to: "/dashboard/gerar-flashcards",
    icon: FlipVertical,
    title: "Gerador de Flashcards",
    description:
      "Flashcards clínicos com casos, diagnósticos e condutas. Salvos automaticamente no banco para revisão espaçada (FSRS).",
    accent: "info",
    category: "memoria",
  },
  {
    to: "/dashboard/mnemonico",
    icon: Brain,
    title: "Mnemônico Visual",
    description:
      "Mnemônicos com imagem 3D Pixar para memorizar listas médicas. Pipeline com auditoria pedagógica e visual em 8 etapas.",
    accent: "violet",
    isNew: true,
    category: "memoria",
  },
  {
    to: "/dashboard/coach",
    icon: Heart,
    title: "Coach Motivacional",
    description:
      "Apoio emocional e estratégico para ansiedade, burnout e organização da rotina. Use quando precisar de suporte humano.",
    accent: "rose",
    category: "suporte",
  },
];

const CATEGORY_META = {
  ensino: {
    label: "Aulas & Teoria",
    eyebrow: "Ensino guiado",
    description: "Agentes que ensinam, explicam e aprofundam temas com profundidade clínica.",
  },
  treino: {
    label: "Treino & Simulação",
    eyebrow: "Performance",
    description: "Coloque a mão na massa — questões, casos, anamnese e plantão simulado.",
  },
  memoria: {
    label: "Memória & Reforço",
    eyebrow: "Retenção",
    description: "Ferramentas de memorização cinematográfica integradas ao FSRS.",
  },
  suporte: {
    label: "Mente & Emoção",
    eyebrow: "Bem-estar",
    description: "Suporte emocional e estratégico para a maratona da residência.",
  },
} as const;

const SPOTLIGHT: SpotlightAgent[] = [
  {
    to: "/dashboard/sessao-estudo",
    icon: Sparkles,
    title: "Aprenda qualquer tema com seu Tutor IA",
    description:
      "Aula completa pelo Protocolo ENAZIZI: explicação → fisiopatologia → clínica → questões → caso discursivo. Tudo guiado pelo GPT-4o.",
    accent: "success",
    eyebrow: "Agente principal",
  },
  {
    to: "/dashboard/cronicas",
    icon: BookOpen,
    title: "Crônicas Médicas — você é o médico no plantão",
    description:
      "Casos clínicos cinematográficos onde cada decisão importa. Aprenda medicina como quem assiste um filme.",
    accent: "amber",
    eyebrow: "Novo agente cinematográfico",
  },
  {
    to: "/dashboard/mnemonico",
    icon: Brain,
    title: "Mnemônico Visual — Pixar para memorização",
    description:
      "Cenas 3D + associação fonética + quiz visual. O jeito mais rápido de gravar listas médicas para a banca.",
    accent: "violet",
    eyebrow: "Memorização avançada",
  },
];

const CATEGORIES = ["ensino", "treino", "memoria", "suporte"] as const;

export default function AgentsHub() {
  return (
    <div className="space-y-10 animate-fade-in">
      <CinematicHero
        module="enaflix"
        eyebrow={
          <>
            <Sparkles className="h-3.5 w-3.5" />
            ENAFLIX · Universo de Agentes IA
          </>
        }
        title="Sua sala de mentores inteligentes"
        subtitle="Cada agente é um especialista cinematográfico treinado para uma missão na sua aprovação. Escolha quem entra em cena agora."
        media={
          <div className="hidden lg:flex h-28 w-28 items-center justify-center rounded-3xl glass-premium-strong">
            <Sparkles className="h-12 w-12 text-module" />
          </div>
        }
      />

      {/* Spotlight rotativo cinematográfico */}
      <AgentSpotlight agents={SPOTLIGHT} />

      {/* Categorias narrativas */}
      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const items = AGENTS.filter((a) => a.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="space-y-4">
            <header className="space-y-1">
              <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-primary/80">
                {meta.eyebrow}
              </span>
              <h2 id={`cat-${cat}`} className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {meta.label}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">{meta.description}</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((a) => (
                <AgentPosterCard
                  key={a.to}
                  to={a.to}
                  icon={a.icon}
                  title={a.title}
                  description={a.description}
                  accent={a.accent}
                  isNew={a.isNew}
                  highlight={a.highlight}
                  badge={a.badge}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
