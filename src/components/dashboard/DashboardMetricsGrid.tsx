import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Target, CheckCircle2, Flame, CalendarDays, AlertTriangle, Award,
  FlipVertical, TrendingUp, PenTool, Activity, ClipboardList,
  Upload, FileCheck, Stethoscope, BookOpen, HelpCircle, Globe,
  ChevronDown, ImageIcon, MessageSquare, GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats, DashboardMetrics } from "@/hooks/useDashboardData";

interface Props {
  stats: DashboardStats;
  metrics: DashboardMetrics;
}

const DashboardMetricsGrid = ({ stats, metrics }: Props) => {
  const [showSecondary, setShowSecondary] = useState(false);

  return (
    <>
      {/* Primary KPIs - Top 4 with visual emphasis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/dashboard/simulados" className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Target className="h-6 w-6 text-primary mb-3" />
          <div className="text-3xl font-bold">{metrics.questionsAnswered}</div>
          <div className="text-sm text-muted-foreground mt-1">Questões respondidas</div>
        </Link>

        <Link to="/dashboard/simulados" className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CheckCircle2 className={cn("h-6 w-6 mb-3", metrics.accuracy >= 70 ? "text-green-500" : metrics.accuracy >= 50 ? "text-yellow-500" : "text-red-500")} />
          <div className="text-3xl font-bold">{metrics.accuracy}%</div>
          <div className="text-sm text-muted-foreground mt-1">Taxa de acerto</div>
        </Link>

        <Link to="/dashboard/conquistas" className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Flame className={cn("h-6 w-6 mb-3", stats.streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
          <div className="text-3xl font-bold">{stats.streak}</div>
          <div className="text-sm text-muted-foreground mt-1">Dias de streak</div>
        </Link>

        <Link to="/dashboard/sessao-estudo?focus=reviews" className="glass-card p-5 hover:border-primary/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CalendarDays className={cn("h-6 w-6 mb-3", metrics.pendingRevisoes > 0 ? "text-yellow-500" : "text-green-500")} />
          <div className="text-3xl font-bold">{metrics.pendingRevisoes}</div>
          <div className="text-sm text-muted-foreground mt-1">Revisões pendentes</div>
        </Link>
      </div>

      {/* Collapsible secondary stats */}
      <div>
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
              { to: "/dashboard/simulados", icon: Award, value: metrics.simuladosCompleted, label: "Simulados feitos" },
              { to: "/dashboard/banco-erros", icon: AlertTriangle, value: metrics.errorsCount, label: "Erros registrados", iconColor: metrics.errorsCount > 0 ? "text-red-500" : "text-green-500" },
              { to: "/dashboard/flashcards", icon: FlipVertical, value: stats.flashcards, label: "Flashcards" },
              { to: "/dashboard/simulados", icon: PenTool, value: metrics.questionsCreated, label: "Questões criadas" },
              { to: "/dashboard/plantao", icon: Activity, value: metrics.clinicalSimulations, label: "Simulações clínicas" },
              { to: "/dashboard/anamnese", icon: ClipboardList, value: metrics.anamnesisCompleted, label: "Anamneses" },
              { to: "/dashboard/planner", icon: CheckCircle2, value: `${stats.completedTasks}/${stats.totalTasks}`, label: "Tarefas concluídas" },
              { to: "/dashboard/resumos", icon: FileCheck, value: metrics.summariesCreated, label: "Resumos gerados" },
              { to: "/dashboard/uploads", icon: Upload, value: stats.uploads, label: "Uploads" },
              { to: "/dashboard/discursivas", icon: Stethoscope, value: metrics.discursivasCompleted, label: "Discursivas feitas" },
              { to: "/dashboard/cronicas", icon: BookOpen, value: metrics.chroniclesCompleted, label: "Crônicas médicas" },
              { to: "/dashboard/image-quiz", icon: ImageIcon, value: metrics.imageQuizAttempts, label: "Questões com imagem" },
              { to: "/dashboard/mentor", icon: MessageSquare, value: metrics.chatConversations, label: "Conversas IA" },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="glass-card p-4 hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <item.icon className={cn("h-4 w-4", item.iconColor || "text-primary")} />
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-xl font-bold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Global Knowledge Base Banner */}
      {(metrics.globalFlashcards > 0 || metrics.globalQuestions > 0) && (
        <div className="glass-card p-5 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Base de Conhecimento Global</h3>
              <p className="text-xs text-muted-foreground">Conteúdo colaborativo gerado por todos os usuários</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/dashboard/flashcards" className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
              <FlipVertical className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <div className="text-lg font-bold">{metrics.globalFlashcards}</div>
                <div className="text-xs text-muted-foreground">Flashcards globais</div>
              </div>
            </Link>
            <Link to="/dashboard/simulados" className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors">
              <HelpCircle className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <div className="text-lg font-bold">{metrics.globalQuestions}</div>
                <div className="text-xs text-muted-foreground">Questões globais</div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardMetricsGrid;
