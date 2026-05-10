import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Bell, AlertTriangle, ShieldAlert } from "lucide-react";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import type { TabCronograma } from "@/pages/CronogramaInteligente";

interface Props {
  tab: TabCronograma;
  setTab: (t: TabCronograma) => void;
  revisoesHoje: number;
  revisoesAtrasadas: number;
  temasCriticos: number;
}

const TABS: { key: TabCronograma; label: string }[] = [
  { key: "visao", label: "📊 Visão Geral" },
  { key: "hoje", label: "📅 Agenda" },
  { key: "novo", label: "➕ Novo Tema" },
  { key: "temas", label: "📚 Temas" },
  { key: "criticos", label: "⚠️ Críticos" },
  // [planner-unification-final] Aba "📋 Plano de Estudos" removida da navegação.
  // StudyPlanContent (shape semanal weeklySchedule) está aposentado — fonte viva oficial é daily_plans/daily_plan_tasks.
  // O componente StudyPlanContent é mantido em modo @deprecated-flow para retrocompatibilidade.
  { key: "historico", label: "📜 Histórico" },
  { key: "graficos", label: "📈 Gráficos" },
  { key: "config", label: "⚙️ Config" },
];

const TAB_HELP: Record<string, { title: string; steps: string[] }> = {
  visao: {
    title: "Visão Geral",
    steps: [
      "Veja seus KPIs: revisões pendentes, temas ativos e taxa de retenção",
      "Os cards mostram revisões do dia e temas críticos com atalhos rápidos",
      "Clique nos badges coloridos para ir direto à aba correspondente",
      "Use esta aba como painel de decisão antes de começar a estudar",
    ],
  },
  hoje: {
    title: "Agenda do Dia",
    steps: [
      "Aqui aparecem todas as revisões agendadas para hoje, ordenadas por prioridade",
      "O indicador de risco (🔴🟡🟢) mostra a chance de esquecer o tema",
      "Clique em 'Concluir' e registre seu desempenho (Fácil, Médio, Difícil)",
      "O algoritmo recalcula o próximo intervalo de revisão com base na sua resposta",
      "Revisões atrasadas aparecem no topo com destaque vermelho",
    ],
  },
  novo: {
    title: "Adicionar Novo Tema",
    steps: [
      "Preencha o nome do tema (ex: 'Insuficiência Cardíaca')",
      "Selecione a especialidade médica correspondente",
      "Escolha a dificuldade inicial: Fácil, Médio ou Difícil",
      "Opcionalmente, adicione a fonte de estudo (ex: Harrison, Sabiston)",
      "Ao salvar, a primeira revisão é agendada automaticamente",
    ],
  },
  temas: {
    title: "Todos os Temas",
    steps: [
      "Veja todos os temas cadastrados com status e próxima revisão",
      "Use a busca para encontrar temas por nome ou especialidade",
      "Filtre por status: pendente, em dia, atrasado ou concluído",
      "Clique em um tema para editar dificuldade, fonte ou observações",
      "Use o botão excluir para remover temas que não precisa mais revisar",
    ],
  },
  criticos: {
    title: "Temas Críticos",
    steps: [
      "Lista os temas com baixa retenção ou muitos erros acumulados",
      "Temas aparecem aqui quando o desempenho cai abaixo do esperado",
      "Clique em 'Revisar Agora' para iniciar uma sessão focada no tema",
      "Após melhorar o desempenho, o tema sai automaticamente desta lista",
    ],
  },
  // [planner-unification-final] Ajuda da aba "plano" removida.
  historico: {
    title: "Histórico de Revisões",
    steps: [
      "Veja todas as revisões já realizadas com data e desempenho",
      "Filtre por período, especialidade ou nível de dificuldade",
      "Acompanhe a evolução do seu desempenho ao longo do tempo",
      "Use o histórico para identificar padrões nos seus erros",
    ],
  },
  graficos: {
    title: "Gráficos e Evolução",
    steps: [
      "O gráfico de linha mostra sua taxa de acerto ao longo das semanas",
      "O gráfico de barras exibe revisões concluídas por especialidade",
      "Veja a distribuição de dificuldade dos seus temas ativos",
      "Use os gráficos para priorizar áreas com desempenho mais baixo",
    ],
  },
  config: {
    title: "Configurações",
    steps: [
      "Defina sua meta diária de revisões e questões",
      "Escolha os dias da semana disponíveis para estudo",
      "Ajuste o número máximo de revisões por dia",
      "Ative ou desative revisões extras automáticas",
      "Configure os pesos do algoritmo de repetição espaçada",
    ],
  },
};

const CronogramaHeader = ({ tab, setTab, revisoesHoje, revisoesAtrasadas, temasCriticos }: Props) => {
  const currentHelp = TAB_HELP[tab] || TAB_HELP["visao"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Cronograma Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central de decisão de estudo • Repetição espaçada baseada em erros
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <ModuleHelpButton
            moduleKey={`cronograma_${tab}`}
            moduleName={currentHelp.title}
            steps={currentHelp.steps}
          />
          {revisoesAtrasadas > 0 && (
            <Badge variant="destructive" className="animate-pulse text-xs px-2.5 py-1 cursor-pointer" onClick={() => setTab("hoje")}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {revisoesAtrasadas} atrasada{revisoesAtrasadas > 1 ? "s" : ""}
            </Badge>
          )}
          {revisoesHoje > 0 && (
            <Badge variant="destructive" className="text-xs px-2.5 py-1 cursor-pointer" onClick={() => setTab("hoje")}>
              <Bell className="h-3 w-3 mr-1" />
              {revisoesHoje} para hoje
            </Badge>
          )}
          {temasCriticos > 0 && (
            <Badge variant="secondary" className="text-xs px-2.5 py-1 cursor-pointer" onClick={() => setTab("criticos")}>
              <ShieldAlert className="h-3 w-3 mr-1" />
              {temasCriticos} crítico{temasCriticos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(t.key)}
            className="whitespace-nowrap text-xs px-3 h-8"
          >
            {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CronogramaHeader;
