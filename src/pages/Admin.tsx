import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Shield, UserCog, Search, RefreshCw, Bell, UserCheck, MessageSquare, Send, Star, Filter, X, Mail, BarChart3, Upload, Bug, ToggleLeft, ImageIcon, HardDrive, LayoutDashboard, FileText, Settings, Activity, Users, Megaphone, ChevronLeft, ChevronRight, Layers, ExternalLink, GitBranch, Wrench, Sparkles, TrendingDown, ShieldCheck, BrainCircuit, Beaker, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_MODULES } from "@/hooks/useModuleAccess";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AdminUser, Stats } from "@/components/admin/AdminTypes";
import { CinematicHero } from "@/components/cinematic";

// Lazy load all admin panels
const WhatsAppPanel = lazy(() => import("@/components/admin/WhatsAppPanel"));
const AIStudio = lazy(() => import("@/pages/admin/AIStudio"));
const TelegramConfigPanel = lazy(() => import("@/components/admin/TelegramConfigPanel"));
const AdminStatsCards = lazy(() => import("@/components/admin/AdminStatsCards"));
const AdminOnlineUsers = lazy(() => import("@/components/admin/AdminOnlineUsers"));
const AdminPlanDistribution = lazy(() => import("@/components/admin/AdminPlanDistribution"));
const AdminDailyGenerationAlert = lazy(() => import("@/components/admin/AdminDailyGenerationAlert"));
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
const AdaptiveEngineAdmin = lazy(() => import("@/pages/admin/AdaptiveEngineAdmin"));
const SystemChecklist = lazy(() => import("@/pages/admin/SystemChecklist"));
const AdminInterventionPolicies = lazy(() => import("@/pages/admin/AdminInterventionPolicies"));
const AdminAdaptiveExperiments = lazy(() => import("@/pages/admin/AdminAdaptiveExperiments"));
const IntelligenceOverviewPanel = lazy(() => import("@/components/admin/IntelligenceOverviewPanel"));

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
      title: "Visão Geral",
      icon: LayoutDashboard,
      items: [
        { key: "overview", label: "Dashboard", icon: LayoutDashboard },
        { key: "online", label: "Usuários Online", icon: Activity },
      ],
    },
    {
      title: "Usuários",
      icon: Users,
      items: [
        { key: "users-all", label: "Todos", icon: UserCog },
        { key: "users-pending", label: "Pendentes", icon: Bell, badge: pendingCount },
        { key: "users-active", label: "Ativos", icon: UserCheck },
        { key: "users-blocked", label: "Bloqueados", icon: Shield },
      ],
    },
    {
      title: "Conteúdo",
      icon: FileText,
      items: [
        { key: "pipeline", label: "Pipeline", icon: Layers },
        { key: "questions", label: "Questões", icon: FileText },
        { key: "image-upgrade", label: "Upgrade Imagem", icon: ImageIcon },
        { key: "image-review", label: "Review Imagem", icon: ImageIcon },
        { key: "hygiene", label: "Higiene", icon: Bug },
        { key: "ingestion", label: "Ingestão", icon: Upload },
        { key: "scraping", label: "Web Scraping", icon: HardDrive },
        { key: "qa", label: "QA Bot", icon: Bug },
        { key: "ai-studio", label: "AI Studio", icon: Sparkles },
        { key: "system-checklist", label: "System Checklist", icon: ShieldCheck },
      ],
    },
    {
      title: "Comunicação",
      icon: Megaphone,
      items: [
        { key: "messages", label: "Mensagens", icon: Mail },
        { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
        { key: "telegram", label: "Telegram", icon: Send },
      ],
    },
    {
      title: "Intelligence Engine",
      icon: BrainCircuit,
      items: [
        { key: "intelligence-overview", label: "Visão Geral IA", icon: LayoutDashboard },
        { key: "knowledge-graph", label: "Knowledge Graph", icon: GitBranch },
        { key: "adaptive-engine", label: "ACE Engine", icon: BrainCircuit },
        { key: "intervention-policies", label: "Governança/Políticas", icon: ShieldCheck },
        { key: "adaptive-experiments", label: "Experimentos A/B", icon: Beaker },
        { key: "specialty-friction", label: "Atrito Cognitivo", icon: TrendingDown },
      ],
    },
    {
      title: "Analytics & Auditoria",
      icon: BarChart3,
      items: [
        { key: "bi", label: "BI & Métricas", icon: BarChart3 },
        { key: "feedbacks", label: "Feedbacks", icon: Star },
        { key: "audit", label: "Log de Auditoria", icon: Shield },
      ],
    },
    {
      title: "Configurações",
      icon: Settings,
      items: [
        { key: "flags", label: "Feature Flags", icon: ToggleLeft },
        { key: "uploads", label: "Uploads", icon: Upload },
        { key: "upload2gb", label: "Upload 2GB", icon: HardDrive },
        { key: "multimodal", label: "Multimodal", icon: ImageIcon },
      ],
    },
  ];
}

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Main Admin Component ─────────────────────────────
const Admin = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterFaculdade, setFilterFaculdade] = useState<string>("all");
  const [filterPeriodo, setFilterPeriodo] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);

  // Action handlers (same logic as before)
  const handleAction = useCallback(async (userId: string, fn: () => Promise<void>) => {
    setActionLoading(userId);
    try { await fn(); loadData(); } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally { setActionLoading(null); }
  }, [loadData, toast]);

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
      toast({ title: "Usuário excluído", description: `${deleteDialog.user!.display_name || deleteDialog.user!.email} foi permanentemente excluído.` });
      setDeleteDialog({ open: false, user: null });
    });
  };

  // Computed
  const uniqueFaculdades = [...new Set(users.map(u => u.faculdade).filter(Boolean))].sort() as string[];
  const uniquePeriodos = [...new Set(users.map(u => u.periodo).filter(Boolean))].sort((a, b) => (a as number) - (b as number)) as number[];
  const pendingCount = users.filter((u) => u.status === "pending").length;
  const activeCount = users.filter((u) => u.status === "active" && !u.is_blocked).length;
  const blockedCount = users.filter((u) => u.is_blocked || u.status === "disabled").length;
  const getUserPlan = (u: AdminUser) => u.subscription?.plans?.name || "Free";

  const userTab = activeSection.startsWith("users-") ? activeSection.replace("users-", "") : "all";

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = (u.display_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterFaculdade !== "all" && u.faculdade !== filterFaculdade) return false;
    if (filterPeriodo !== "all" && String(u.periodo) !== filterPeriodo) return false;
    switch (userTab) {
      case "pending": return u.status === "pending";
      case "active": return u.status === "active" && !u.is_blocked;
      case "blocked": return u.is_blocked || u.status === "disabled";
      default: return true;
    }
  });

  const getStatusBadge = (u: AdminUser) => {
    if (u.is_blocked) return <Badge variant="destructive" className="text-xs">Bloqueado</Badge>;
    switch (u.status) {
      case "pending": return <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "active": return <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">Ativo</Badge>;
      case "disabled": return <Badge variant="destructive" className="text-xs">Rejeitado</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{u.status}</Badge>;
    }
  };

  const navGroups = buildNavGroups(pendingCount);

  const isUserSection = activeSection.startsWith("users-");

  // ─── Render ─────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6">
      {/* ─── Sidebar ─── */}
      <aside className={cn(
        "flex-shrink-0 border-r border-border bg-muted/30 transition-all duration-300 overflow-hidden",
        sidebarCollapsed ? "w-14" : "w-56"
      )}>
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Admin</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-3rem)]">
          <nav className="p-2 space-y-4">
            {navGroups.map((group) => (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeSection === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <>
                            <span className="truncate flex-1 text-left">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                              <Badge className="h-5 min-w-[20px] px-1 text-[10px] bg-amber-500 text-white border-0">
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                        {sidebarCollapsed && item.badge && item.badge > 0 && (
                          <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
          {/* Cinematic hero — sóbrio, técnico, premium */}
          {activeSection === "overview" && (
            <CinematicHero
              module="admin"
              eyebrow={
                <>
                  <Shield className="h-3.5 w-3.5" />
                  Centro de operações
                </>
              }
              title="Painel Administrativo"
              subtitle="Operação, qualidade e governança do ENAZIZI em tempo real."
              actions={
                <Button variant="outline" size="lg" onClick={loadData} disabled={loading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Atualizar dados
                </Button>
              }
              className="py-6 sm:py-8"
            />
          )}

          {/* Header bar (para outras seções) */}
          {activeSection !== "overview" && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold">
                  {navGroups.flatMap(g => g.items).find(i => i.key === activeSection)?.label || "Painel Admin"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-7">
                  {users.length} usuários
                </Badge>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
              </div>
            </div>
          )}

          {/* Pending alert (shown in overview & user sections) */}
          {pendingCount > 0 && (activeSection === "overview" || activeSection === "users-pending") && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Bell className="h-5 w-5 text-amber-500 animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">🔔 {pendingCount} usuário{pendingCount > 1 ? "s" : ""} aguardando aprovação</p>
              </div>
              <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0" onClick={() => setActiveSection("users-pending")}>
                <UserCheck className="h-4 w-4" /> Revisar
              </Button>
            </div>
          )}

          {/* ═══ Section Content ═══ */}
          <Suspense fallback={<PanelLoader />}>
            {/* Overview */}
            {activeSection === "overview" && (
              <div className="space-y-6">
                {/* Alerta de contaminação da baseline (apenas-leitura, admin-only) */}
                <BaselineFreezeAlert />
                <AdminStatsCards stats={stats} pendingCount={pendingCount} activeCount={activeCount} blockedCount={blockedCount} />
                <AdminPlanDistribution stats={stats} />
                <AdminDailyGenerationAlert />

                {/* Atalhos para ferramentas administrativas internas (rotas /admin/*) */}
                <div className="rounded-lg border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Ferramentas administrativas</h3>
                    <Badge variant="outline" className="text-[10px]">rotas internas</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Páginas operacionais não listadas na sidebar. Acesse aqui para evitar perder a URL.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <Link
                      to="/admin/classification-runner"
                      className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <GitBranch className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-1">
                          Classification Runner
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Executor + auditoria do classify-question-hierarchy
                        </div>
                      </div>
                    </Link>
                    <Link
                      to="/admin/classification"
                      className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <Layers className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-1">
                          Classification Backfill
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Backfill incremental de classificação
                        </div>
                      </div>
                    </Link>
                    <Link
                      to="/admin/coverage-boost"
                      className="flex items-start gap-2 p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <Activity className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-1">
                          Coverage Boost
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Bridge coverage → study engine
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "online" && (
              <AdminOnlineUsers stats={stats} onUserClick={(userId) => {
                const found = users.find(u => u.user_id === userId);
                if (found) setUserDetailDialog({ open: true, user: found });
                else toast({ title: "Usuário não encontrado" });
              }} />
            )}

            {/* Users sections */}
            {isUserSection && (
              <div className="space-y-4">
                {/* Search + filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome ou email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterFaculdade} onValueChange={setFilterFaculdade}>
                      <SelectTrigger className="w-[180px] h-9 text-xs">
                        <SelectValue placeholder="Universidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas universidades</SelectItem>
                        {uniqueFaculdades.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                      <SelectTrigger className="w-[130px] h-9 text-xs">
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {uniquePeriodos.map((p) => (
                          <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(filterFaculdade !== "all" || filterPeriodo !== "all") && (
                      <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setFilterFaculdade("all"); setFilterPeriodo("all"); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sub-tabs for user status */}
                <Tabs value={userTab} onValueChange={(v) => setActiveSection(`users-${v}`)}>
                  <TabsList className="h-9">
                    <TabsTrigger value="all" className="text-xs gap-1">Todos <Badge variant="secondary" className="text-[10px] ml-1">{users.length}</Badge></TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs gap-1">Pendentes {pendingCount > 0 && <Badge className="text-[10px] ml-1 bg-amber-500 text-white">{pendingCount}</Badge>}</TabsTrigger>
                    <TabsTrigger value="active" className="text-xs gap-1">Ativos <Badge variant="secondary" className="text-[10px] ml-1">{activeCount}</Badge></TabsTrigger>
                    <TabsTrigger value="blocked" className="text-xs gap-1">Bloqueados <Badge variant="secondary" className="text-[10px] ml-1">{blockedCount}</Badge></TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Results */}
                <div className="text-xs text-muted-foreground">{filteredUsers.length} resultado{filteredUsers.length !== 1 ? "s" : ""}</div>

                {loading ? (
                  <PanelLoader />
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {userTab === "pending" ? "Nenhum usuário aguardando aprovação." : "Nenhum usuário encontrado."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden md:grid grid-cols-14 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <div className="col-span-2">Usuário</div>
                      <div className="col-span-2">Email</div>
                      <div className="col-span-1">Plano</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Último acesso</div>
                      <div className="col-span-3">Evolução</div>
                      <div className="col-span-4 text-right">Ações</div>
                    </div>
                    {filteredUsers.map((u) => (
                      <AdminUserRow
                        key={u.user_id}
                        u={u}
                        actionLoading={actionLoading}
                        session={session}
                        getStatusBadge={getStatusBadge}
                        getUserPlan={getUserPlan}
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
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            {activeSection === "pipeline" && <AdminPipelineMonitor />}
            {activeSection === "questions" && <AdminQuestionReviewPanel />}
            {activeSection === "image-upgrade" && <ImageQuestionUpgradePanel />}
            {activeSection === "image-review" && <AdminImageQuestionReviewPanel />}
            {activeSection === "hygiene" && <AdminHygieneDashboard />}
            {activeSection === "ingestion" && <AdminIngestionPanel />}
            {activeSection === "scraping" && <AdminWebScrapingPanel />}
            {activeSection === "qa" && <AdminQAPanel />}
            {activeSection === "ai-studio" && <AIStudio />}
            {activeSection === "system-checklist" && <SystemChecklist />}

            {/* Intelligence Engine */}
            {activeSection === "intelligence-overview" && <IntelligenceOverviewPanel />}
            {activeSection === "knowledge-graph" && <MedicalKnowledgeGraph />}
            {activeSection === "adaptive-engine" && <AdaptiveEngineAdmin />}
            {activeSection === "intervention-policies" && <AdminInterventionPolicies />}
            {activeSection === "adaptive-experiments" && <AdminAdaptiveExperiments />}
            {activeSection === "specialty-friction" && <SpecialtyFrictionReport />}

            {/* Communication */}
            {activeSection === "messages" && <AdminMessagesPanel />}
            {activeSection === "whatsapp" && <WhatsAppPanel session={session} />}
            {activeSection === "telegram" && <TelegramConfigPanel />}

            {/* Analytics */}
            {activeSection === "bi" && (
              <div className="space-y-4">
                <AdminHealthHistory />
                <AdminBIPanel callAdmin={callAdmin} />
              </div>
            )}
            {activeSection === "knowledge-graph" && <MedicalKnowledgeGraph />}
            {activeSection === "adaptive-engine" && <AdaptiveEngineAdmin />}
            {activeSection === "specialty-friction" && <SpecialtyFrictionReport />}
            {activeSection === "feedbacks" && <AdminFeedbackPanel />}
            {activeSection === "audit" && <AdminAuditLog auditLogs={auditLogs} auditLoading={auditLoading} loadAuditLog={loadAuditLog} />}

            {/* Settings */}
            {activeSection === "flags" && <AdminFeatureFlags />}
            {activeSection === "uploads" && <AdminUploadsPanel />}
            {activeSection === "upload2gb" && <AdminLargeUploadPanel />}
            {activeSection === "multimodal" && <AdminModalityPanel />}
          </Suspense>
        </div>
      </main>

      {/* Dialogs */}
      <Suspense fallback={null}>
        <AdminDialogs
          users={users}
          actionLoading={actionLoading}
          getStatusBadge={getStatusBadge}
          getUserPlan={getUserPlan}
          callAdmin={callAdmin}
          toast={toast}
          session={session}
          userDetailDialog={userDetailDialog}
          setUserDetailDialog={setUserDetailDialog}
          blockDialog={blockDialog}
          setBlockDialog={setBlockDialog}
          handleBlock={handleBlock}
          logoutDialog={logoutDialog}
          setLogoutDialog={setLogoutDialog}
          setActionLoading={setActionLoading}
          planDialog={planDialog}
          setPlanDialog={setPlanDialog}
          handleChangePlan={handleChangePlan}
          adminDialog={adminDialog}
          setAdminDialog={setAdminDialog}
          handleToggleAdmin={handleToggleAdmin}
          professorDialog={professorDialog}
          setProfessorDialog={setProfessorDialog}
          handleToggleProfessor={handleToggleProfessor}
          passwordDialog={passwordDialog}
          setPasswordDialog={setPasswordDialog}
          handleResetPassword={handleResetPassword}
          trackingDialog={trackingDialog}
          setTrackingDialog={setTrackingDialog}
          accessDialog={accessDialog}
          setAccessDialog={setAccessDialog}
          handleSaveAccess={handleSaveAccess}
          deleteDialog={deleteDialog}
          setDeleteDialog={setDeleteDialog}
          handleDeleteUser={handleDeleteUser}
        />
      </Suspense>
    </div>
  );
};

export default Admin;
