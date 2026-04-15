import { useState, useEffect, useCallback } from "react";
import { Shield, UserCog, Search, RefreshCw, Bell, UserCheck, MessageSquare, Send, Star, Filter, X, Mail, BarChart3, Upload, Bug, ToggleLeft, ImageIcon, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_MODULES } from "@/hooks/useModuleAccess";
import WhatsAppPanel from "@/components/admin/WhatsAppPanel";
import TelegramConfigPanel from "@/components/admin/TelegramConfigPanel";
import AdminStatsCards from "@/components/admin/AdminStatsCards";
import AdminOnlineUsers from "@/components/admin/AdminOnlineUsers";
import AdminPlanDistribution from "@/components/admin/AdminPlanDistribution";
import AdminDailyGenerationAlert from "@/components/admin/AdminDailyGenerationAlert";
import AdminPipelineMonitor from "@/components/admin/AdminPipelineMonitor";
import AdminWebScrapingPanel from "@/components/admin/AdminWebScrapingPanel";
import AdminIngestionPanel from "@/components/admin/AdminIngestionPanel";
import AdminQuestionReviewPanel from "@/components/admin/AdminQuestionReviewPanel";
import AdminAuditLog from "@/components/admin/AdminAuditLog";
import AdminDialogs from "@/components/admin/AdminDialogs";
import AdminUserRow from "@/components/admin/AdminUserRow";
import AdminFeedbackPanel from "@/components/admin/AdminFeedbackPanel";
import AdminMessagesPanel from "@/components/admin/AdminMessagesPanel";
import AdminBIPanel from "@/components/admin/AdminBIPanel";
import AdminUploadsPanel from "@/components/admin/AdminUploadsPanel";
import AdminHealthHistory from "@/components/admin/AdminHealthHistory";
import AdminQAPanel from "@/components/admin/AdminQAPanel";
import AdminFeatureFlags from "@/components/admin/AdminFeatureFlags";
import ImageQuestionUpgradePanel from "@/components/admin/ImageQuestionUpgradePanel";
import AdminImageQuestionReviewPanel from "@/components/admin/AdminImageQuestionReviewPanel";
import AdminModalityPanel from "@/components/admin/AdminModalityPanel";
import AdminHygieneDashboard from "@/components/admin/AdminHygieneDashboard";
import AdminLargeUploadPanel from "@/components/admin/AdminLargeUploadPanel";
import type { AdminUser, Stats } from "@/components/admin/AdminTypes";

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
  const [activeTab, setActiveTab] = useState("all");

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

  // Action handlers
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

  // Unique faculdades and periodos for filters
  const uniqueFaculdades = [...new Set(users.map(u => u.faculdade).filter(Boolean))].sort() as string[];
  const uniquePeriodos = [...new Set(users.map(u => u.periodo).filter(Boolean))].sort((a, b) => (a as number) - (b as number)) as number[];

  // Computed values
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = (u.display_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterFaculdade !== "all" && u.faculdade !== filterFaculdade) return false;
    if (filterPeriodo !== "all" && String(u.periodo) !== filterPeriodo) return false;
    switch (activeTab) {
      case "pending": return u.status === "pending";
      case "active": return u.status === "active" && !u.is_blocked;
      case "blocked": return u.is_blocked || u.status === "disabled";
      default: return true;
    }
  });

  const pendingCount = users.filter((u) => u.status === "pending").length;
  const activeCount = users.filter((u) => u.status === "active" && !u.is_blocked).length;
  const blockedCount = users.filter((u) => u.is_blocked || u.status === "disabled").length;
  const getUserPlan = (u: AdminUser) => u.subscription?.plans?.name || "Free";

  const getStatusBadge = (u: AdminUser) => {
    if (u.is_blocked) return <Badge variant="destructive" className="text-xs">Bloqueado</Badge>;
    switch (u.status) {
      case "pending": return <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Pendente</Badge>;
      case "active": return <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">Ativo</Badge>;
      case "disabled": return <Badge variant="destructive" className="text-xs">Rejeitado</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{u.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            Painel Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie usuários, aprovações, planos e assinaturas.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-xs h-7">
            {users.length} usuários
          </Badge>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Pending notification */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-in slide-in-from-top duration-300">
          <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">🔔 {pendingCount} novo{pendingCount > 1 ? "s" : ""} usuário{pendingCount > 1 ? "s" : ""} aguardando aprovação</p>
            <p className="text-xs text-muted-foreground">Clique na aba "Novos Usuários" para revisar</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setActiveTab("pending")}>
            <UserCheck className="h-4 w-4" /> Revisar agora
          </Button>
        </div>
      )}

      <AdminStatsCards stats={stats} pendingCount={pendingCount} activeCount={activeCount} blockedCount={blockedCount} />
      <AdminOnlineUsers stats={stats} onUserClick={(userId) => {
        const found = users.find(u => u.user_id === userId);
        if (found) { setUserDetailDialog({ open: true, user: found }); }
        else { toast({ title: "Usuário não encontrado na lista carregada" }); }
      }} />
      <AdminPlanDistribution stats={stats} />
      <AdminDailyGenerationAlert />
      <AdminPipelineMonitor />
      <AdminWebScrapingPanel />
      <AdminIngestionPanel />
      <AdminQuestionReviewPanel />
      <div className="glass-card p-6">
        <ImageQuestionUpgradePanel />
      </div>
      <AdminImageQuestionReviewPanel />
      <AdminHygieneDashboard />

      {/* Users with tabs */}
      <div className="glass-card p-6">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Gerenciar Usuários
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterFaculdade} onValueChange={setFilterFaculdade}>
              <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs">
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
              <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos períodos</SelectItem>
                {uniquePeriodos.map((p) => (
                  <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterFaculdade !== "all" || filterPeriodo !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1"
                onClick={() => { setFilterFaculdade("all"); setFilterPeriodo("all"); }}
              >
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            )}

            {(filterFaculdade !== "all" || filterPeriodo !== "all") && (
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredUsers.length} resultado{filteredUsers.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 flex flex-wrap h-auto gap-1 justify-start">
            <TabsTrigger value="all" className="gap-1.5">
              Todos <Badge variant="secondary" className="text-xs ml-1">{users.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              🔔 Novos Usuários
              {pendingCount > 0 && <Badge className="text-xs ml-1 bg-amber-500 text-white">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1.5">
              Ativos <Badge variant="secondary" className="text-xs ml-1">{activeCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1.5">
              Bloqueados <Badge variant="secondary" className="text-xs ml-1">{blockedCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Telegram
            </TabsTrigger>
            <TabsTrigger value="feedbacks" className="gap-1.5">
              <Star className="h-3.5 w-3.5" /> Feedbacks
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Mensagens
            </TabsTrigger>
            <TabsTrigger value="bi" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> BI
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Uploads
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-1.5">
              <Bug className="h-3.5 w-3.5" /> QA
            </TabsTrigger>
            <TabsTrigger value="flags" className="gap-1.5">
              <ToggleLeft className="h-3.5 w-3.5" /> Flags
            </TabsTrigger>
            <TabsTrigger value="multimodal" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Multimodal
            </TabsTrigger>
            <TabsTrigger value="upload2gb" className="gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> Upload 2GB
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp">
            <WhatsAppPanel session={session} />
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramConfigPanel />
          </TabsContent>

          <TabsContent value="feedbacks">
            <AdminFeedbackPanel />
          </TabsContent>

          <TabsContent value="messages">
            <AdminMessagesPanel />
          </TabsContent>

          <TabsContent value="bi">
            <div className="space-y-4">
              <AdminHealthHistory />
              <AdminBIPanel callAdmin={callAdmin} />
            </div>
          </TabsContent>

          <TabsContent value="uploads">
            <AdminUploadsPanel />
          </TabsContent>

          <TabsContent value="qa">
            <AdminQAPanel />
          </TabsContent>

          <TabsContent value="flags">
            <AdminFeatureFlags />
          </TabsContent>

          <TabsContent value="multimodal">
            <AdminModalityPanel />
          </TabsContent>

          <TabsContent value={activeTab === "whatsapp" || activeTab === "telegram" || activeTab === "feedbacks" || activeTab === "messages" || activeTab === "bi" || activeTab === "uploads" || activeTab === "qa" || activeTab === "flags" || activeTab === "multimodal" ? "__none__" : activeTab}>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {activeTab === "pending" ? "Nenhum usuário aguardando aprovação." : "Nenhum usuário encontrado."}
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
          </TabsContent>
        </Tabs>
      </div>

      <AdminAuditLog auditLogs={auditLogs} auditLoading={auditLoading} loadAuditLog={loadAuditLog} />

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
    </div>
  );
};

export default Admin;
