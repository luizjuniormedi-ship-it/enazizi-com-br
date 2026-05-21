import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  Shield, UserCog, Search, RefreshCw, Bell, UserCheck, MessageSquare, Send, Star, Filter, X, Mail, 
  BarChart3, Upload, Bug, ToggleLeft, ImageIcon, HardDrive, LayoutDashboard, FileText, Settings, 
  Activity, Users, Megaphone, ChevronLeft, ChevronRight, Layers, ExternalLink, GitBranch, Wrench, 
  Sparkles, TrendingDown, ShieldCheck, BrainCircuit, Beaker, Zap, Film, Wand2, BookOpen, Loader2, Play,
  Lock, AlertTriangle, MonitorPlay, Database, ActivitySquare, Terminal, Microscope, Video, Database as DatabaseIcon
} from "lucide-react";

import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixLoader } from "@/components/enaflix/EnaflixLoader";
import { EnaflixCinematicCard } from "@/components/enaflix/EnaflixCinematicCard";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_MODULES } from "@/hooks/useModuleAccess";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AdminUser, Stats } from "@/components/admin/AdminTypes";
import { motion, AnimatePresence } from "framer-motion";

// Lazy load all admin panels
const WhatsAppPanel = lazy(() => import("@/components/admin/WhatsAppPanel"));
const AIStudio = lazy(() => import("@/pages/admin/AIStudio"));
const TelegramConfigPanel = lazy(() => import("@/components/admin/TelegramConfigPanel"));
const AdminStatsCards = lazy(() => import("@/components/admin/AdminStatsCards"));
const AdminOnlineUsers = lazy(() => import("@/components/admin/AdminOnlineUsers"));
const AdminPlanDistribution = lazy(() => import("@/components/admin/AdminPlanDistribution"));
const AdminDailyGenerationAlert = lazy(() => import("@/components/admin/AdminDailyGenerationAlert"));
const ForceUpdateButton = lazy(() => import("@/components/layout/ForceUpdateButton"));
const BaselineFreezeAlert = lazy(() => import("@/components/admin/BaselineFreezeAlert"));
const AdminPipelineMonitor = lazy(() => import("@/components/admin/AdminPipelineMonitor"));
const AdminWebScrapingPanel = lazy(() => import("@/components/admin/AdminWebScrapingPanel"));
const AdminIngestionPanel = lazy(() => import("@/components/admin/AdminIngestionPanel"));
const AdminQuestionReviewPanel = lazy(() => import("@/components/admin/AdminQuestionReviewPanel"));
const AdminAuditLog = lazy(() => import("@/components/admin/AdminAuditLog"));
const AdminDialogs = lazy(() => import("@/components/admin/AdminDialogs"));
const AdminUserRow = lazy(() => import("@/components/admin/AdminUserRow"));
const AdminFeedbackPanel = lazy(() => import("@/components/admin/AdminFeedbackPanel"));
const AdminMessagesPanel = lazy(() => import("@/components/admin/AdminMessagesPanel"));
const AdminBIPanel = lazy(() => import("@/components/admin/AdminBIPanel"));
const AdminUploadsPanel = lazy(() => import("@/components/admin/AdminUploadsPanel"));
const AdminHealthHistory = lazy(() => import("@/components/admin/AdminHealthHistory"));
const AdminQAPanel = lazy(() => import("@/components/admin/AdminQAPanel"));
const AdminFeatureFlags = lazy(() => import("@/components/admin/AdminFeatureFlags"));
const ImageQuestionUpgradePanel = lazy(() => import("@/components/admin/ImageQuestionUpgradePanel"));
const AdminImageQuestionReviewPanel = lazy(() => import("@/components/admin/AdminImageQuestionReviewPanel"));
const AdminModalityPanel = lazy(() => import("@/components/admin/AdminModalityPanel"));
const AdminHygieneDashboard = lazy(() => import("@/components/admin/AdminHygieneDashboard"));
const AdminLargeUploadPanel = lazy(() => import("@/components/admin/AdminLargeUploadPanel"));
const SpecialtyFrictionReport = lazy(() => import("@/pages/admin/SpecialtyFrictionReport"));
const MedicalKnowledgeGraph = lazy(() => import("@/pages/admin/MedicalKnowledgeGraph"));
const AdminAutomationLab = lazy(() => import("@/components/admin/AdminAutomationLab"));
const AdaptiveEngineAdmin = lazy(() => import("@/pages/admin/AdaptiveEngineAdmin"));
const SystemChecklist = lazy(() => import("@/pages/admin/SystemChecklist"));
const AdminInterventionPolicies = lazy(() => import("@/pages/admin/AdminInterventionPolicies"));
const AdminAdaptiveExperiments = lazy(() => import("@/pages/admin/AdminAdaptiveExperiments"));
const IntelligenceOverviewPanel = lazy(() => import("@/components/admin/IntelligenceOverviewPanel"));
const AdminCognitiveOrchestrator = lazy(() => import("@/pages/admin/AdminCognitiveOrchestrator"));
const AdminCinematicEngine = lazy(() => import("@/pages/AdminCinematicEngine"));
const AdminLessonsMemory = lazy(() => import("@/pages/admin/AdminLessonsMemory"));
const AdminLessonRatingsPanel = lazy(() => import("@/components/admin/AdminLessonRatingsPanel").then(m => ({ default: m.AdminLessonRatingsPanel })));
const TutorLessonStructureDashboard = lazy(() => import("@/components/admin/TutorLessonStructureDashboard").then(m => ({ default: m.TutorLessonStructureDashboard })));
const TutorVideoAuditPanel = lazy(() => import("@/components/admin/TutorVideoAuditPanel").then(m => ({ default: m.TutorVideoAuditPanel })));
const KnowledgeBaseAdmin = lazy(() => import("@/components/admin/KnowledgeBaseAdmin").then(m => ({ default: m.KnowledgeBaseAdmin })));
const TutorQAPanel = lazy(() => import("@/components/admin/TutorQAPanel"));
const ExamHarvesterPanel = lazy(() => import("@/components/admin/ExamHarvesterPanel").then(m => ({ default: m.ExamHarvesterPanel })));
const TutorStabilizationDashboard = lazy(() => import("@/components/admin/cognitive-observatory/TutorStabilizationDashboard").then(m => ({ default: m.TutorStabilizationDashboard })));



// ─── Navigation structure ─────────────────────────────
interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

function buildNavGroups(pendingCount: number): NavGroup[] {
  return [
    {
      title: "OPERATIVO",
      icon: Terminal,
      items: [
        { key: "overview", label: "Dashboard", icon: LayoutDashboard },
        { key: "users-all", label: "Usuários", icon: Users },
        { key: "users-pending", label: "Aprovações", icon: Lock, badge: pendingCount },
      ],
    },
    {
      title: "CONTEÚDO & QUESTÕES",
      icon: FileText,
      items: [
        { key: "uploads", label: "Upload Arquivos", icon: Upload },
        { key: "knowledge-base", label: "Base RAG", icon: DatabaseIcon },
        { key: "ingestion", label: "Gerar Questões", icon: Wand2 },
        { key: "question-review", label: "Aprovar Questões", icon: UserCheck },
        { key: "image-review", label: "Aprovar Imagens", icon: ImageIcon },
        { key: "scraping", label: "Web Scraping", icon: Search },
        { key: "harvester", label: "Exam Harvester", icon: Database },

      ],
    },
    {
      title: "PRODUÇÃO ENAFLIX",
      icon: MonitorPlay,
      items: [
        { key: "pipeline", label: "Pipeline", icon: Layers },
        { key: "cinematic-engine", label: "CME Studio", icon: Film },
        { key: "tutor-lessons", label: "Aulas Memory", icon: BookOpen },
        { key: "lesson-ratings", label: "Avaliações Aulas", icon: Star },
        { key: "tutor-video-audit", label: "Auditoria Vídeo", icon: Video },
        { key: "tutor-structure-tests", label: "Testes Estrutura", icon: Microscope },
        { key: "tutor-stabilization", label: "Estabilidade Tutor", icon: Activity },
        { key: "ai-studio", label: "AI Studio", icon: Sparkles },

      ],
    },
    {
      title: "INTELLIGENCE ACE",
      icon: BrainCircuit,
      items: [
        { key: "intelligence-overview", label: "Radar IA", icon: ActivitySquare },
        { key: "adaptive-engine", label: "ACE Engine", icon: BrainCircuit },
        { key: "cognitive-orchestrator", label: "Orquestrador", icon: Activity },
        { key: "specialty-friction", label: "Atrito", icon: TrendingDown },
      ],
    },
    {
      title: "SISTEMA & FEEDBACK",
      icon: Settings,
      items: [
        { key: "messages", label: "Mensagens ADM", icon: MessageSquare },
        { key: "feedback", label: "Feedbacks", icon: Star },
        { key: "features", label: "Flags de Sistema", icon: ShieldCheck },
        { key: "integrations", label: "WhatsApp/Chat", icon: Send },
      ],
    },
    {
      title: "AUDITORIA & DADOS",
      icon: Database,
      items: [
        { key: "bi", label: "BI & KPIs", icon: BarChart3 },
        { key: "audit", label: "Auditoria", icon: Shield },
        { key: "system-checklist", label: "Checklist", icon: ShieldCheck },
        { key: "tutor-qa", label: "Tutor QA Engine", icon: Beaker },

      ],
    },
  ];
}



function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <EnaflixLoader variant="default" label="Sincronizando Command Center..." />
    </div>
  );
}

interface AdminProps {
  initialTab?: string;
}

const Admin = ({ initialTab }: AdminProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState(initialTab || "overview");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let tab = searchParams.get("tab");
    if (tab) {
      // Aliases for better navigation compatibility
      if (tab === "users") tab = "users-all";
      if (tab === "audit-log") tab = "audit";
      
      setActiveSection(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveSection(tab);
    setSearchParams({ tab });
  };
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [planDialog, setPlanDialog] = useState<{ open: boolean; user: AdminUser | null; plan: string }>({ open: false, user: null, plan: "" });
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; user: AdminUser | null; block: boolean }>({ open: false, user: null, block: false });
  const [adminDialog, setAdminDialog] = useState<{ open: boolean; user: AdminUser | null; makeAdmin: boolean }>({ open: false, user: null, makeAdmin: false });
  const [professorDialog, setProfessorDialog] = useState<{ open: boolean; user: AdminUser | null; makeProfessor: boolean }>({ open: false, user: null, makeProfessor: false });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; user: AdminUser | null; password: string }>({ open: false, user: null, password: "" });
  const [userDetailDialog, setUserDetailDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [trackingDialog, setTrackingDialog] = useState<{ open: boolean; user: AdminUser | null; data: any; loading: boolean }>({ open: false, user: null, data: null, loading: false });
  const [logoutDialog, setLogoutDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [accessDialog, setAccessDialog] = useState<{ open: boolean; user: AdminUser | null; modules: Record<string, boolean>; loading: boolean; saving: boolean }>({ open: false, user: null, modules: {}, loading: false, saving: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`;

  const callAdmin = useCallback(async (body: Record<string, unknown>) => {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro na operação");
    return data;
  }, [session, API_URL]);

  const loadAuditLog = useCallback(async () => {
    if (!session) return;
    setAuditLoading(true);
    try {
      const res = await callAdmin({ action: "get_audit_log", limit: 50 });
      setAuditLogs(res.logs || []);
    } catch {
      toast({ title: "Erro", description: "Erro ao carregar log de auditoria", variant: "destructive" });
    } finally {
      setAuditLoading(false);
    }
  }, [session, callAdmin, toast]);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        callAdmin({ action: "list_users" }),
        callAdmin({ action: "get_stats" }),
      ]);
      setUsers(usersRes.users || []);
      setStats(statsRes);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, callAdmin, toast]);

  useEffect(() => { 
    loadData(); 
    loadAuditLog();
  }, [loadData, loadAuditLog]);

  useEffect(() => {
    if (activeSection === "audit") loadAuditLog();
  }, [activeSection, loadAuditLog]);

  const handleAction = useCallback(async (userId: string, fn: () => Promise<void>) => {
    setActionLoading(userId);
    try { 
      await fn(); 
      // Invalida cache de roles para o usuário afetado
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      await loadData(); 
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally { setActionLoading(null); }
  }, [loadData, toast, queryClient]);

  const handleApproveUser = (u: AdminUser) => handleAction(u.user_id, async () => {
    await callAdmin({ action: "approve_user", target_user_id: u.user_id });
    toast({ title: "Usuário aprovado!", description: `${u.display_name || u.email} agora pode acessar o sistema.` });
  });

  const handleRejectUser = (u: AdminUser) => handleAction(u.user_id, async () => {
    await callAdmin({ action: "reject_user", target_user_id: u.user_id });
    toast({ title: "Usuário rejeitado", description: `${u.display_name || u.email} foi rejeitado.` });
  });

  const handleBlock = async () => {
    if (!blockDialog.user) return;
    await handleAction(blockDialog.user.user_id, async () => {
      await callAdmin({ action: "block_user", target_user_id: blockDialog.user!.user_id, blocked: blockDialog.block });
      toast({ title: blockDialog.block ? "Usuário bloqueado" : "Usuário desbloqueado" });
      setBlockDialog({ open: false, user: null, block: false });
    });
  };

  const handleChangePlan = async () => {
    if (!planDialog.user || !planDialog.plan) return;
    await handleAction(planDialog.user.user_id, async () => {
      await callAdmin({ action: "change_plan", target_user_id: planDialog.user!.user_id, plan_name: planDialog.plan });
      toast({ title: "Plano alterado" });
      setPlanDialog({ open: false, user: null, plan: "" });
    });
  };

  const handleToggleAdmin = async () => {
    if (!adminDialog.user) return;
    await handleAction(adminDialog.user.user_id, async () => {
      await callAdmin({ action: "toggle_admin", target_user_id: adminDialog.user!.user_id, make_admin: adminDialog.makeAdmin });
      toast({ title: adminDialog.makeAdmin ? "Admin promovido" : "Admin removido" });
      setAdminDialog({ open: false, user: null, makeAdmin: false });
    });
  };

  const handleToggleProfessor = async () => {
    if (!professorDialog.user) return;
    await handleAction(professorDialog.user.user_id, async () => {
      await callAdmin({ action: "toggle_professor", target_user_id: professorDialog.user!.user_id, make_professor: professorDialog.makeProfessor });
      toast({ title: professorDialog.makeProfessor ? "Professor promovido" : "Professor removido" });
      setProfessorDialog({ open: false, user: null, makeProfessor: false });
    });
  };

  const handleResetPassword = async () => {
    if (!passwordDialog.user || passwordDialog.password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    await handleAction(passwordDialog.user.user_id, async () => {
      await callAdmin({ action: "reset_password", target_user_id: passwordDialog.user!.user_id, new_password: passwordDialog.password });
      toast({ title: "Senha redefinida" });
      setPasswordDialog({ open: false, user: null, password: "" });
    });
  };

  const loadUserTracking = useCallback(async (u: AdminUser) => {
    setTrackingDialog({ open: true, user: u, data: null, loading: true });
    try {
      const res = await callAdmin({ action: "get_user_tracking", target_user_id: u.user_id });
      setTrackingDialog((prev) => ({ ...prev, data: res, loading: false }));
    } catch {
      toast({ title: "Erro", description: "Erro ao carregar dados do usuário", variant: "destructive" });
      setTrackingDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [callAdmin, toast]);

  const loadUserAccess = useCallback(async (u: AdminUser) => {
    setAccessDialog({ open: true, user: u, modules: {}, loading: true, saving: false });
    try {
      const res = await callAdmin({ action: "get_user_access", target_user_id: u.user_id });
      const mods: Record<string, boolean> = {};
      ALL_MODULES.forEach(m => { mods[m.key] = true; });
      (res.modules || []).forEach((m: { module_key: string; enabled: boolean }) => { mods[m.module_key] = m.enabled; });
      setAccessDialog(prev => ({ ...prev, modules: mods, loading: false }));
    } catch {
      toast({ title: "Erro", description: "Erro ao carregar acessos", variant: "destructive" });
      setAccessDialog(prev => ({ ...prev, loading: false }));
    }
  }, [callAdmin, toast]);

  const handleSaveAccess = async () => {
    if (!accessDialog.user) return;
    setAccessDialog(prev => ({ ...prev, saving: true }));
    try {
      const modules = ALL_MODULES.map(m => ({ module_key: m.key, enabled: accessDialog.modules[m.key] ?? true }));
      await callAdmin({ action: "set_user_access", target_user_id: accessDialog.user.user_id, modules });
      toast({ title: "Acessos salvos" });
      setAccessDialog({ open: false, user: null, modules: {}, loading: false, saving: false });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao salvar", variant: "destructive" });
      setAccessDialog(prev => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;
    await handleAction(deleteDialog.user.user_id, async () => {
      await callAdmin({ action: "delete_user", target_user_id: deleteDialog.user!.user_id });
      toast({ title: "Usuário excluído" });
      setDeleteDialog({ open: false, user: null });
    });
  };

  const navGroups = buildNavGroups(users.filter(u => u.status === "pending").length);

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white selection:bg-primary/30 relative">
      <EnaflixBackgroundFX intensity="subtle" />
      
      {/* Cinematic Hero - Command Center Style */}
      <div className="pt-8 pb-12 px-6 lg:px-12 max-w-[1600px] mx-auto space-y-8 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-2 w-10 bg-gradient-to-r from-primary to-accent rounded-full" />
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/50">Command Center</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white leading-tight drop-shadow-2xl">
              ENAFLIX <span className="gradient-text">Studio Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
              <Enaflix3DButton variant="outline" size="sm" onClick={loadData} iconLeft={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}>
                Atualizar Sincronização
              </Enaflix3DButton>
              
              <Suspense fallback={null}>
                <ForceUpdateButton 
                  variant="sidebar" 
                  className="bg-white/5 border-white/10 text-white/60 hover:text-white h-11 px-4"
                />
              </Suspense>
             <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative">
               <Bell className="h-5 w-5 text-white/60" />
               <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
             </div>
          </div>
        </div>

        {/* Global Stats - Command Style Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
           <EnaflixCinematicCard variant="analytics" className="p-6 space-y-2">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Usuários Totais</p>
             <div className="flex items-baseline gap-2">
               <h3 className="text-3xl font-black text-white">{stats?.totalUsers || "—"}</h3>
               <span className="text-xs text-emerald-400 font-bold">+12%</span>
             </div>
             <Users className="absolute top-4 right-4 h-5 w-5 text-white/10" />
           </EnaflixCinematicCard>
           <EnaflixCinematicCard variant="analytics" className="p-6 space-y-2">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Usuários Online</p>
             <div className="flex items-baseline gap-2">
               <h3 className="text-3xl font-black text-white">{stats?.onlineUsers || 0}</h3>
               <span className="text-xs text-primary font-bold">Live</span>
             </div>
             <Layers className="absolute top-4 right-4 h-5 w-5 text-white/10" />
           </EnaflixCinematicCard>
           <EnaflixCinematicCard variant="analytics" className="p-6 space-y-2">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Saúde Engine</p>
             <div className="flex items-baseline gap-2">
               <h3 className="text-3xl font-black text-white">99.8%</h3>
               <span className="text-xs text-emerald-400 font-bold">Optimal</span>
             </div>
             <Activity className="absolute top-4 right-4 h-5 w-5 text-white/10" />
           </EnaflixCinematicCard>
           <EnaflixCinematicCard variant="analytics" className="p-6 space-y-2">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Assinaturas Pro</p>
             <div className="flex items-baseline gap-2">
               <h3 className="text-3xl font-black text-white">{stats?.activeSubs || 0}</h3>
               <span className="text-xs text-emerald-400 font-bold">Active</span>
             </div>
             <Zap className="absolute top-4 right-4 h-5 w-5 text-white/10" />
           </EnaflixCinematicCard>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-10 items-start">
          {/* Sidebar Admin Style */}
          <aside className="space-y-8 sticky top-8">
            <div className="glass-premium-strong rounded-[32px] p-6 space-y-8 border border-white/10">
              {navGroups.map((group) => (
                <div key={group.title} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <group.icon className="h-3.5 w-3.5 text-primary/60" />
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{group.title}</h4>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleTabChange(item.key)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative group",
                          activeSection === item.key 
                            ? "bg-primary text-white shadow-glow-sm" 
                            : "text-white/40 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", activeSection === item.key ? "text-white" : "text-white/40")} />
                        <span className="text-xs font-black tracking-tight">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-auto bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Support/Quick Links */}
            <div className="p-6 rounded-[32px] bg-gradient-to-br from-primary/10 to-transparent border border-white/5 space-y-3">
               <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Suporte Interno</p>
               <Enaflix3DButton variant="ghost" size="sm" className="w-full justify-start gap-3">
                  <Bug className="h-4 w-4" /> Incidentes
               </Enaflix3DButton>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0">
             <AnimatePresence mode="wait">
               <motion.div
                 key={activeSection}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="space-y-8"
               >
                 {activeSection === "overview" && (
                   <div className="space-y-8">
                     <EnaflixSectionTitle kicker="STATUS OPERACIONAL" title="Visão Geral" />
                     <BaselineFreezeAlert />
                     <Suspense fallback={<PanelLoader />}>
                       <AdminStatsCards 
                         stats={stats} 
                         pendingCount={users.filter(u => u.status === "pending").length} 
                         activeCount={users.filter(u => u.status === "active").length} 
                         blockedCount={users.filter(u => u.is_blocked).length} 
                       />
                     </Suspense>
                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <Suspense fallback={<PanelLoader />}><AdminOnlineUsers stats={stats} /></Suspense>
                        <Suspense fallback={<PanelLoader />}><AdminPlanDistribution stats={stats} /></Suspense>
                     </div>
                   </div>
                 )}

                 {activeSection === "users-all" && (
                   <div className="space-y-6">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <EnaflixSectionTitle kicker="GESTÃO DE ACESSO" title="Usuários da Plataforma" />
                        <div className="flex items-center gap-3">
                          <Input 
                            placeholder="Buscar por nome ou e-mail..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full md:w-64 bg-white/5 border-white/10 text-white rounded-xl h-11"
                          />
                        </div>
                     </div>
                     <EnaflixCinematicCard variant="dashboard" className="p-0 overflow-hidden">
                       <ScrollArea className="h-[600px]">
                         <div className="p-4 space-y-2">
                           {users
                             .filter(u => u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
                             .map(u => (
                               <AdminUserRow 
                                 key={u.user_id} 
                                 u={u} 
                                 actionLoading={actionLoading}
                                 session={session}
                                 getStatusBadge={(u) => <Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status}</Badge>}
                                 getUserPlan={(u) => u.subscription?.plans?.name || "Free"}
                                 onApprove={handleApproveUser}
                                 onReject={handleRejectUser}
                                 onOpenDetail={(u) => setUserDetailDialog({ open: true, user: u })}
                                 onOpenAdmin={(u, makeAdmin) => setAdminDialog({ open: true, user: u, makeAdmin })}
                                 onOpenProfessor={(u, makeProfessor) => setProfessorDialog({ open: true, user: u, makeProfessor })}
                                 onOpenPlan={(u, plan) => setPlanDialog({ open: true, user: u, plan })}
                                 onOpenPassword={(u) => setPasswordDialog({ open: true, user: u, password: "" })}
                                 onOpenBlock={(u, block) => setBlockDialog({ open: true, user: u, block })}
                                 onOpenLogout={(u) => setLogoutDialog({ open: true, user: u })}
                                 onOpenTracking={loadUserTracking}
                                 onOpenAccess={loadUserAccess}
                                 onOpenDelete={(u) => setDeleteDialog({ open: true, user: u })}
                               />
                             ))
                           }
                         </div>
                       </ScrollArea>
                     </EnaflixCinematicCard>
                   </div>
                 )}

                 {activeSection === "users-pending" && (
                   <div className="space-y-6">
                      <EnaflixSectionTitle kicker="FILA DE ENTRADA" title="Aprovações Pendentes" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {users.filter(u => u.status === "pending").map(u => (
                           <EnaflixCinematicCard key={u.user_id} className="p-6 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center font-black">
                                  {u.display_name?.[0] || u.email[0]}
                                </div>
                                <div>
                                  <h4 className="font-black text-white">{u.display_name || "Sem nome"}</h4>
                                  <p className="text-xs text-white/40">{u.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Enaflix3DButton size="sm" onClick={() => handleApproveUser(u)}>Aprovar</Enaflix3DButton>
                                <Enaflix3DButton variant="outline" size="sm" onClick={() => handleRejectUser(u)}>Recusar</Enaflix3DButton>
                              </div>
                           </EnaflixCinematicCard>
                         ))}
                         {users.filter(u => u.status === "pending").length === 0 && (
                            <div className="col-span-full py-12 text-center text-white/20 italic">
                               Nenhuma aprovação pendente.
                            </div>
                         )}
                      </div>
                   </div>
                 )}

                  {activeSection === "uploads" && <Suspense fallback={<PanelLoader />}><AdminUploadsPanel /></Suspense>}
                  {activeSection === "ingestion" && <Suspense fallback={<PanelLoader />}><AdminIngestionPanel /></Suspense>}
                  {activeSection === "question-review" && <Suspense fallback={<PanelLoader />}><AdminQuestionReviewPanel /></Suspense>}
                  {activeSection === "image-review" && <Suspense fallback={<PanelLoader />}><AdminImageQuestionReviewPanel /></Suspense>}
                  {activeSection === "scraping" && <Suspense fallback={<PanelLoader />}><AdminWebScrapingPanel /></Suspense>}
                   {activeSection === "harvester" && <Suspense fallback={<PanelLoader />}><ExamHarvesterPanel /></Suspense>}
                   {activeSection === "pipeline" && <Suspense fallback={<PanelLoader />}><AdminPipelineMonitor /></Suspense>}

                  {activeSection === "cinematic-engine" && <Suspense fallback={<PanelLoader />}><AdminCinematicEngine /></Suspense>}
                  {activeSection === "knowledge-base" && <KnowledgeBaseAdmin />}
                  {activeSection === "ai-studio" && <Suspense fallback={<PanelLoader />}><AIStudio /></Suspense>}
                  {activeSection === "tutor-lessons" && <Suspense fallback={<PanelLoader />}><AdminLessonsMemory /></Suspense>}
                  {activeSection === "tutor-stabilization" && <Suspense fallback={<PanelLoader />}><TutorStabilizationDashboard /></Suspense>}
                  {activeSection === "lesson-ratings" && <Suspense fallback={<PanelLoader />}><AdminLessonRatingsPanel /></Suspense>}
                  {activeSection === "tutor-video-audit" && <Suspense fallback={<PanelLoader />}><TutorVideoAuditPanel /></Suspense>}
                  {activeSection === "tutor-structure-tests" && <Suspense fallback={<PanelLoader />}><TutorLessonStructureDashboard /></Suspense>}
                  {activeSection === "intelligence-overview" && <Suspense fallback={<PanelLoader />}><IntelligenceOverviewPanel /></Suspense>}

                  {activeSection === "adaptive-engine" && <Suspense fallback={<PanelLoader />}><AdaptiveEngineAdmin /></Suspense>}
                  {activeSection === "cognitive-orchestrator" && <Suspense fallback={<PanelLoader />}><AdminCognitiveOrchestrator /></Suspense>}
                  {activeSection === "specialty-friction" && <Suspense fallback={<PanelLoader />}><SpecialtyFrictionReport /></Suspense>}
                  {activeSection === "messages" && <Suspense fallback={<PanelLoader />}><AdminMessagesPanel /></Suspense>}
                  {activeSection === "feedback" && <Suspense fallback={<PanelLoader />}><AdminFeedbackPanel /></Suspense>}
                  {activeSection === "features" && <Suspense fallback={<PanelLoader />}><AdminFeatureFlags /></Suspense>}
                  {activeSection === "integrations" && (
                    <div className="space-y-8">
                       <Suspense fallback={<PanelLoader />}><WhatsAppPanel session={session} /></Suspense>
                       <Suspense fallback={<PanelLoader />}><TelegramConfigPanel /></Suspense>
                    </div>
                  )}

                  {activeSection === "bi" && <Suspense fallback={<PanelLoader />}><AdminBIPanel callAdmin={callAdmin} /></Suspense>}
                  {activeSection === "audit" && <Suspense fallback={<PanelLoader />}><AdminAuditLog auditLogs={auditLogs} auditLoading={auditLoading} loadAuditLog={loadAuditLog} /></Suspense>}
                  {activeSection === "system-checklist" && <Suspense fallback={<PanelLoader />}><SystemChecklist /></Suspense>}
                  {activeSection === "tutor-qa" && <Suspense fallback={<PanelLoader />}><TutorQAPanel /></Suspense>}




               </motion.div>
             </AnimatePresence>
          </main>
        </div>
      </div>

      <AdminDialogs 
        users={users}
        actionLoading={actionLoading}
        getStatusBadge={(u) => <Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status}</Badge>}
        getUserPlan={(u) => u.subscription?.plans?.name || "Free"}
        callAdmin={callAdmin}
        toast={toast}
        session={session}
        setActionLoading={setActionLoading}
        planDialog={planDialog} setPlanDialog={setPlanDialog} handleChangePlan={handleChangePlan}
        blockDialog={blockDialog} setBlockDialog={setBlockDialog} handleBlock={handleBlock}
        adminDialog={adminDialog} setAdminDialog={setAdminDialog} handleToggleAdmin={handleToggleAdmin}
        professorDialog={professorDialog} setProfessorDialog={setProfessorDialog} handleToggleProfessor={handleToggleProfessor}
        passwordDialog={passwordDialog} setPasswordDialog={setPasswordDialog} handleResetPassword={handleResetPassword}
        userDetailDialog={userDetailDialog} setUserDetailDialog={setUserDetailDialog}
        trackingDialog={trackingDialog} setTrackingDialog={setTrackingDialog}
        logoutDialog={logoutDialog} setLogoutDialog={setLogoutDialog}
        accessDialog={accessDialog} setAccessDialog={setAccessDialog} handleSaveAccess={handleSaveAccess}
        deleteDialog={deleteDialog} setDeleteDialog={setDeleteDialog} handleDeleteUser={handleDeleteUser}
      />
    </div>
  );
};

export default Admin;