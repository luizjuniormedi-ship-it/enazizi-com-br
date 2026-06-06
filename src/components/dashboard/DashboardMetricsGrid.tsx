import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Target, CheckCircle2, Flame, CalendarDays, AlertTriangle, Award,
  FlipVertical, TrendingUp, PenTool, Activity, ClipboardList,
  Upload, FileCheck, Stethoscope, BookOpen, HelpCircle, Globe,
  ChevronDown, ImageIcon, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats, DashboardMetrics } from "@/hooks/useDashboardData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  stats: DashboardStats;
  metrics: DashboardMetrics;
}

const DashboardMetricsGrid = ({ stats, metrics }: Props) => {
  const [showSecondary, setShowSecondary] = useState(false);

  return (
    <TooltipProvider>
      {/* Primary KPIs - Top 4 with visual emphasis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/dashboard/simulados" 
              className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Target className="h-6 w-6 text-primary mb-3" />
              <div className="text-3xl font-bold">{metrics.questionsAnswered}</div>
              <div className="text-sm text-muted-foreground mt-1">Questões Respondidas</div>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total de questões respondidas no sistema.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/dashboard/simulados" 
              className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CheckCircle2 className={cn("h-6 w-6 mb-3", metrics.accuracy >= 70 ? "text-green-500" : metrics.accuracy >= 50 ? "text-yellow-500" : "text-red-500")} />
              <div className="text-3xl font-bold">{metrics.accuracy}%</div>
              <div className="text-sm text-muted-foreground mt-1">Taxa de Acerto</div>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Porcentagem média de acertos nas questões respondidas.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/dashboard/conquistas" className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Flame className={cn("h-6 w-6 mb-3", stats.streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
              <div className="text-3xl font-bold">{stats.streak}</div>
              <div className="text-sm text-muted-foreground mt-1">Dias de Sequência</div>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Número de dias consecutivos de estudo (streak).</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/dashboard/sessao-estudo?focus=reviews" 
              className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CalendarDays className={cn("h-6 w-6 mb-3", metrics.pendingRevisoes > 0 ? "text-yellow-500" : "text-green-500")} />
              <div className="text-3xl font-bold">{metrics.pendingRevisoes}</div>
              <div className="text-sm text-muted-foreground mt-1">Revisões Pendentes</div>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Conteúdos que precisam ser revisados hoje com base no algoritmo de repetição espaçada.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Collapsible secondary stats */}
      <div className="mt-8">
        <button
          onClick={() => setShowSecondary(!showSecondary)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", showSecondary ? "" : "-rotate-90")} />
          {showSecondary ? "Ocultar detalhes" : "Ver mais métricas"} ({metrics.simuladosCompleted} simulados, {metrics.errorsCount} erros, {stats.flashcards} flashcards)
        </button>

        {showSecondary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in">
            {[
              { to: "/dashboard/simulados", icon: Award, value: metrics.simuladosCompleted, label: "Simulados Feitos", tooltip: "Total de simulados concluídos." },
              { to: "/dashboard/banco-erros", icon: AlertTriangle, value: metrics.errorsCount, label: "Erros Registrados", iconColor: metrics.errorsCount > 0 ? "text-red-500" : "text-green-500", tooltip: "Número total de questões erradas registradas para revisão." },
              { to: "/dashboard/flashcards", icon: FlipVertical, value: stats.flashcards, label: "Flashcards", tooltip: "Quantidade de flashcards criados ou estudados." },
              { to: "/dashboard/simulados", icon: PenTool, value: metrics.questionsCreated, label: "Questões Criadas", tooltip: "Questões personalizadas criadas por você." },
              { to: "/dashboard/plantao", icon: Activity, value: metrics.clinicalSimulations, label: "Simulações Clínicas", tooltip: "Participações em simulações de casos clínicos." },
              { to: "/dashboard/anamnese", icon: ClipboardList, value: metrics.anamnesisCompleted, label: "Anamneses", tooltip: "Entrevistas clínicas estruturadas completadas." },
              { to: "/dashboard/planner", icon: CheckCircle2, value: `${stats.completedTasks}/${stats.totalTasks}`, label: "Tarefas Concluídas", tooltip: "Progresso das suas tarefas no planejador." },
              { to: "/dashboard/resumos", icon: FileCheck, value: metrics.summariesCreated, label: "Resumos Gerados", tooltip: "Resumos automáticos criados pela IA." },
              { to: "/dashboard/uploads", icon: Upload, value: stats.uploads, label: "Uploads", tooltip: "Materiais de estudo carregados na plataforma." },
              { to: "/dashboard/discursivas", icon: Stethoscope, value: metrics.discursivasCompleted, label: "Discursivas Feitas", tooltip: "Questões de resposta aberta completadas." },
              { to: "/dashboard/cronicas", icon: BookOpen, value: metrics.chroniclesCompleted, label: "Crônicas Médicas", tooltip: "Leituras de crônicas clínicas finalizadas." },
              { to: "/dashboard/image-quiz", icon: ImageIcon, value: metrics.imageQuizAttempts, label: "Questões com Imagem", tooltip: "Performance em questões baseadas em imagens radiológicas/clínicas." },
              { to: "/dashboard/mentor", icon: MessageSquare, value: metrics.chatConversations, label: "Conversas IA", tooltip: "Total de interações com o Tutor IA." },
            ].map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link to={item.to} className="glass-card p-4 hover:border-primary/30 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <item.icon className={cn("h-4 w-4", item.iconColor || "text-primary")} />
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xl font-bold">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{item.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default DashboardMetricsGrid;