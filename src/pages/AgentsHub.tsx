import { Link } from "react-router-dom";
import { HelpCircle, BookOpen, Heart, ArrowRight, Sparkles, Activity, FlipVertical, MessageCircle, Brain } from "lucide-react";
import { CinematicHero } from "@/components/cinematic";

const agents = [
  {
    to: "/dashboard/chatgpt",
    icon: Sparkles,
    title: "🤖 Tutor IA — Agente Principal",
    description: "Seu professor particular com GPT-5.4. Aulas completas pelo Protocolo ENAZIZI: explicação → fisiopatologia → clínica → questões → caso discursivo. Use para ESTUDAR qualquer tema.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    highlight: true,
  },
  {
    to: "/dashboard/questoes",
    icon: HelpCircle,
    title: "❓ Gerador de Questões",
    description: "Gera questões objetivas estilo ENARE/USP com casos clínicos, gabarito comentado e referências. Use quando quiser TREINAR questões específicas.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  {
    to: "/dashboard/gerar-flashcards",
    icon: FlipVertical,
    title: "🃏 Gerador de Flashcards",
    description: "Flashcards clínicos com casos, diagnósticos e condutas. Salvos automaticamente no seu banco para revisão espaçada.",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
  },
  {
    to: "/dashboard/resumos",
    icon: BookOpen,
    title: "📖 Resumidor de Conteúdo",
    description: "Cria resumos estruturados com tabelas comparativas, mnemônicos e pegadinhas de prova. Use para REVISAR rapidamente um tema.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    to: "/dashboard/plantao",
    icon: Activity,
    title: "🚨 Modo Plantão",
    description: "Simulação interativa de atendimento clínico. Atenda pacientes virtuais, tome decisões e receba avaliação em tempo real.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    to: "/dashboard/anamnese",
    icon: MessageCircle,
    title: "🩺 Treino de Anamnese",
    description: "Pratique entrevista clínica com pacientes simulados. A IA só responde ao que você perguntar — treine sua técnica semiológica.",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    isNew: true,
  },
  {
    to: "/dashboard/cronicas",
    icon: BookOpen,
    title: "📖 Crônicas Médicas",
    description: "Aprenda medicina através de narrativas clínicas imersivas. Você é o médico no plantão — raciocine, decida e aprenda com casos cinematográficos.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    isNew: true,
  },
  {
    to: "/dashboard/mnemonico",
    icon: Brain,
    title: "🧠 Mnemônico Visual",
    description: "Gere mnemônicos com imagem para memorizar listas médicas de prova. Pipeline com auditoria pedagógica e visual.",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    isNew: true,
  },
  {
    to: "/dashboard/coach",
    icon: Heart,
    title: "💪 Coach Motivacional",
    description: "Apoio emocional e estratégico para ansiedade, burnout e organização da rotina. Use quando precisar de SUPORTE EMOCIONAL.",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
  },
];

const AgentsHub = () => (
  <div className="space-y-6 animate-fade-in">
    <CinematicHero
      module="enaflix"
      eyebrow={
        <>
          <Sparkles className="h-3.5 w-3.5" />
          ENAFLIX · Universo de Agentes IA
        </>
      }
      title="Sua sala de mentores inteligentes"
      subtitle="Cada agente é um especialista cinematográfico treinado para uma missão específica na sua aprovação. Escolha quem entra em cena agora."
      media={
        <div className="hidden lg:flex h-28 w-28 items-center justify-center rounded-3xl glass-premium-strong">
          <Sparkles className="h-12 w-12 text-module" />
        </div>
      }
    />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={`glass-card p-6 hover:border-primary/30 transition-all group flex flex-col justify-between relative ${
            (a as any).highlight ? "ring-1 ring-primary/30 border-primary/20" : ""
          }`}
        >
          {(a as any).isNew && (
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
              NOVO
            </span>
          )}
          <div>
            <div className={`h-12 w-12 rounded-xl ${a.bgColor} flex items-center justify-center mb-4`}>
              <a.icon className={`h-6 w-6 ${a.color}`} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{a.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-primary font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
            Acessar <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      ))}
    </div>
  </div>
);

export default AgentsHub;
