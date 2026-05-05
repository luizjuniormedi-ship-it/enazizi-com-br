import { useState, useEffect } from "react";
import { LogOut, BarChart3, Brain, ClipboardList, CreditCard, AlertTriangle, TrendingUp, BookOpen, Target, Activity, Lock, Phone, GraduationCap, Calendar, Clock, Stethoscope, Building2, PenTool, FileCheck, Upload, FlipVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_MODULES } from "@/hooks/useModuleAccess";
import { supabase } from "@/integrations/supabase/client";
import type { AdminUser } from "./AdminTypes";
import { PLANS } from "./AdminTypes";

interface AdminDialogsProps {
  users: AdminUser[];
  actionLoading: string | null;
  getStatusBadge: (u: AdminUser) => React.ReactNode;
  getUserPlan: (u: AdminUser) => string;
  callAdmin: (body: Record<string, unknown>) => Promise<any>;
  toast: (props: any) => void;
  session: { access_token: string; user?: { id: string } } | null;

  userDetailDialog: { open: boolean; user: AdminUser | null };
  setUserDetailDialog: (v: { open: boolean; user: AdminUser | null }) => void;

  blockDialog: { open: boolean; user: AdminUser | null; block: boolean };
  setBlockDialog: (v: { open: boolean; user: AdminUser | null; block: boolean }) => void;
  handleBlock: () => void;

  logoutDialog: { open: boolean; user: AdminUser | null };
  setLogoutDialog: (v: { open: boolean; user: AdminUser | null }) => void;
  setActionLoading: (v: string | null) => void;

  planDialog: { open: boolean; user: AdminUser | null; plan: string };
  setPlanDialog: (v: any) => void;
  handleChangePlan: () => void;

  adminDialog: { open: boolean; user: AdminUser | null; makeAdmin: boolean };
  setAdminDialog: (v: { open: boolean; user: AdminUser | null; makeAdmin: boolean }) => void;
  handleToggleAdmin: () => void;

  professorDialog: { open: boolean; user: AdminUser | null; makeProfessor: boolean };
  setProfessorDialog: (v: { open: boolean; user: AdminUser | null; makeProfessor: boolean }) => void;
  handleToggleProfessor: () => void;

  passwordDialog: { open: boolean; user: AdminUser | null; password: string };
  setPasswordDialog: (v: any) => void;
  handleResetPassword: () => void;

  trackingDialog: { open: boolean; user: AdminUser | null; data: any; loading: boolean };
  setTrackingDialog: (v: any) => void;

  accessDialog: { open: boolean; user: AdminUser | null; modules: Record<string, boolean>; loading: boolean; saving: boolean };
  setAccessDialog: (v: any) => void;
  handleSaveAccess: () => void;

  deleteDialog: { open: boolean; user: AdminUser | null };
  setDeleteDialog: (v: { open: boolean; user: AdminUser | null }) => void;
  handleDeleteUser: () => void;
}

const AdminDialogs = ({
  users, actionLoading, getStatusBadge, getUserPlan, callAdmin, toast, session,
  userDetailDialog, setUserDetailDialog,
  blockDialog, setBlockDialog, handleBlock,
  logoutDialog, setLogoutDialog, setActionLoading,
  planDialog, setPlanDialog, handleChangePlan,
  adminDialog, setAdminDialog, handleToggleAdmin,
  professorDialog, setProfessorDialog, handleToggleProfessor,
  passwordDialog, setPasswordDialog, handleResetPassword,
  trackingDialog, setTrackingDialog,
  accessDialog, setAccessDialog, handleSaveAccess,
  deleteDialog, setDeleteDialog, handleDeleteUser,
}: AdminDialogsProps) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (userDetailDialog.open && userDetailDialog.user) {
      setProfileLoading(true);
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userDetailDialog.user.user_id)
        .single()
        .then(({ data }) => {
          setProfileData(data);
          setProfileLoading(false);
        });
    } else {
      setProfileData(null);
    }
  }, [userDetailDialog.open, userDetailDialog.user]);

  return (
  <>
    {/* User Detail Dialog */}
    <Dialog open={userDetailDialog.open} onOpenChange={(open) => !open && setUserDetailDialog({ open: false, user: null })}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados de Cadastro</DialogTitle>
          <DialogDescription>Informações completas do perfil do usuário.</DialogDescription>
        </DialogHeader>
        {userDetailDialog.user && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {(userDetailDialog.user.display_name || userDetailDialog.user.email || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{userDetailDialog.user.display_name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground">{userDetailDialog.user.email}</p>
              </div>
            </div>

            {profileLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Data de cadastro:</span><br/>{new Date(userDetailDialog.user.created_at).toLocaleDateString("pt-BR")}</div>
                  <div><span className="text-muted-foreground">Status:</span><br/>{getStatusBadge(userDetailDialog.user)}</div>
                  <div><span className="text-muted-foreground">Plano:</span><br/>{getUserPlan(userDetailDialog.user)}</div>
                  <div><span className="text-muted-foreground">Papel:</span><br/>{userDetailDialog.user.roles.includes("admin") ? "Administrador" : userDetailDialog.user.roles.includes("professor") ? "Professor" : "Usuário"}</div>
                  <div>
                    <span className="text-muted-foreground">ID Organização:</span><br/>
                    <span className="font-mono text-[10px] break-all">{profileData?.organization_id || "Não vinculada"}</span>
                  </div>
                  {userDetailDialog.user.approved_at && (
                    <div><span className="text-muted-foreground">Data da aprovação:</span><br/>{new Date(userDetailDialog.user.approved_at).toLocaleDateString("pt-BR")}</div>
                  )}
                  {userDetailDialog.user.approved_by && (
                    <div><span className="text-muted-foreground">Aprovado por:</span><br/>{users.find(u => u.user_id === userDetailDialog.user!.approved_by)?.display_name || userDetailDialog.user.approved_by}</div>
                  )}
                </div>

                {profileData && (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Pessoais & Acadêmicos</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Telefone</span>
                          <p className="font-medium">{profileData.phone || <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Faculdade</span>
                          <p className="font-medium">{profileData.faculdade || <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Período</span>
                          <p className="font-medium">{profileData.periodo ? `${profileData.periodo}º período` : <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Stethoscope className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Especialidade alvo</span>
                          <p className="font-medium">{profileData.target_specialty || <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Data da prova</span>
                          <p className="font-medium">{profileData.exam_date ? new Date(profileData.exam_date).toLocaleDateString("pt-BR") : <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-muted-foreground text-xs">Horas diárias de estudo</span>
                          <p className="font-medium">{profileData.daily_study_hours != null ? `${profileData.daily_study_hours}h` : <span className="italic text-muted-foreground">Não informado</span>}</p>
                        </div>
                      </div>
                    </div>
                    {profileData.has_completed_diagnostic && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">✓ Diagnóstico concluído</Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Block/Unblock Dialog */}
    <Dialog open={blockDialog.open} onOpenChange={(open) => !open && setBlockDialog({ open: false, user: null, block: false })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blockDialog.block ? "Bloquear usuário" : "Desbloquear usuário"}</DialogTitle>
          <DialogDescription>
            {blockDialog.block
              ? `Tem certeza que deseja bloquear "${blockDialog.user?.display_name || blockDialog.user?.email}"?`
              : `Deseja desbloquear "${blockDialog.user?.display_name || blockDialog.user?.email}"?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBlockDialog({ open: false, user: null, block: false })}>Cancelar</Button>
          <Button variant={blockDialog.block ? "destructive" : "default"} onClick={handleBlock} disabled={!!actionLoading}>
            {blockDialog.block ? "Bloquear" : "Desbloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Force Logout Dialog */}
    <Dialog open={logoutDialog.open} onOpenChange={(open) => !open && setLogoutDialog({ open: false, user: null })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desconectar usuário</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja encerrar todas as sessões ativas de "{logoutDialog.user?.display_name || logoutDialog.user?.email}"? O usuário precisará fazer login novamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLogoutDialog({ open: false, user: null })}>Cancelar</Button>
          <Button
            className="gap-1.5"
            disabled={!!actionLoading}
            onClick={async () => {
              if (!logoutDialog.user) return;
              setActionLoading(logoutDialog.user.user_id);
              try {
                await callAdmin({ action: "force_logout", target_user_id: logoutDialog.user.user_id });
                toast({ title: "Sessão encerrada", description: `Todas as sessões de ${logoutDialog.user.display_name || logoutDialog.user.email} foram encerradas.` });
                setLogoutDialog({ open: false, user: null });
              } catch (e) {
                toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro ao desconectar", variant: "destructive" });
              } finally {
                setActionLoading(null);
              }
            }}
          >
            <LogOut className="h-4 w-4" /> Desconectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Plan Dialog */}
    <Dialog open={planDialog.open} onOpenChange={(open) => !open && setPlanDialog({ open: false, user: null, plan: "" })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar plano</DialogTitle>
          <DialogDescription>Alterar o plano de "{planDialog.user?.display_name || planDialog.user?.email}"</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={planDialog.plan} onValueChange={(v) => setPlanDialog((p: any) => ({ ...p, plan: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="mt-3 text-xs text-muted-foreground">
            {planDialog.plan === "Free" && "50 questões/mês • Gratuito"}
            {planDialog.plan === "Pro" && "2.000 questões/mês • R$59,90"}
            {planDialog.plan === "Premium" && "8.000 questões/mês • R$99,90"}
            {planDialog.plan === "Enterprise" && "Ilimitado • R$299,90"}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPlanDialog({ open: false, user: null, plan: "" })}>Cancelar</Button>
          <Button onClick={handleChangePlan} disabled={!!actionLoading || !planDialog.plan}>Confirmar alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Toggle Admin Dialog */}
    <Dialog open={adminDialog.open} onOpenChange={(open) => !open && setAdminDialog({ open: false, user: null, makeAdmin: false })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{adminDialog.makeAdmin ? "Promover a Administrador" : "Remover Administrador"}</DialogTitle>
          <DialogDescription>
            {adminDialog.makeAdmin
              ? `Deseja tornar "${adminDialog.user?.display_name || adminDialog.user?.email}" um administrador?`
              : `Deseja remover o acesso admin de "${adminDialog.user?.display_name || adminDialog.user?.email}"?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAdminDialog({ open: false, user: null, makeAdmin: false })}>Cancelar</Button>
          <Button onClick={handleToggleAdmin} disabled={!!actionLoading}>
            {adminDialog.makeAdmin ? "Promover" : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Toggle Professor Dialog */}
    <Dialog open={professorDialog.open} onOpenChange={(open) => !open && setProfessorDialog({ open: false, user: null, makeProfessor: false })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{professorDialog.makeProfessor ? "Promover a Professor" : "Remover Professor"}</DialogTitle>
          <DialogDescription>
            {professorDialog.makeProfessor
              ? `Deseja tornar "${professorDialog.user?.display_name || professorDialog.user?.email}" um professor? Ele poderá criar simulados e acompanhar alunos.`
              : `Deseja remover o acesso de professor de "${professorDialog.user?.display_name || professorDialog.user?.email}"?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setProfessorDialog({ open: false, user: null, makeProfessor: false })}>Cancelar</Button>
          <Button onClick={handleToggleProfessor} disabled={!!actionLoading}>
            {professorDialog.makeProfessor ? "Promover" : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Password Dialog */}
    <Dialog open={passwordDialog.open} onOpenChange={(open) => !open && setPasswordDialog({ open: false, user: null, password: "" })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>Defina uma nova senha para "{passwordDialog.user?.display_name || passwordDialog.user?.email}"</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={passwordDialog.password}
            onChange={(e) => setPasswordDialog((p: any) => ({ ...p, password: e.target.value }))} minLength={6} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPasswordDialog({ open: false, user: null, password: "" })}>Cancelar</Button>
          <Button onClick={handleResetPassword} disabled={!!actionLoading || passwordDialog.password.length < 6}>Redefinir senha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* User Tracking Dialog */}
    <Dialog open={trackingDialog.open} onOpenChange={(open) => !open && setTrackingDialog({ open: false, user: null, data: null, loading: false })}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Acompanhamento — {trackingDialog.user?.display_name || trackingDialog.user?.email}
          </DialogTitle>
          <DialogDescription>Visão detalhada do progresso de estudo deste usuário.</DialogDescription>
        </DialogHeader>

        {trackingDialog.loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trackingDialog.data ? (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Questões respondidas", value: trackingDialog.data.stats?.totalAttempts ?? 0, icon: BookOpen },
                { label: "Taxa de acerto", value: `${trackingDialog.data.stats?.accuracy ?? 0}%`, icon: Target },
                { label: "Últimos 7 dias", value: trackingDialog.data.stats?.recentAttempts ?? 0, icon: Activity },
                { label: "Erros catalogados", value: trackingDialog.data.errorBank?.length ?? 0, icon: AlertTriangle },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
                  <s.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Activity Metrics */}
            {trackingDialog.data.activityMetrics && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Activity className="h-4 w-4" /> Atividades do Usuário</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    { label: "Questões criadas", value: trackingDialog.data.activityMetrics.questionsCreated, icon: PenTool },
                    { label: "Simulações clínicas", value: trackingDialog.data.activityMetrics.clinicalSimulations, icon: Stethoscope },
                    { label: "Anamneses", value: trackingDialog.data.activityMetrics.anamnesisCompleted, icon: ClipboardList },
                    { label: "Resumos", value: trackingDialog.data.activityMetrics.summariesCreated, icon: FileCheck },
                    { label: "Discursivas", value: trackingDialog.data.activityMetrics.discursivasCompleted, icon: BookOpen },
                    { label: "Uploads", value: trackingDialog.data.activityMetrics.uploadsCount, icon: Upload },
                  ].map((m) => (
                    <div key={m.label} className="text-center p-2 rounded-lg bg-secondary/50">
                      <m.icon className="h-4 w-4 mx-auto mb-1 text-primary" />
                      <div className="text-lg font-bold">{m.value}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trackingDialog.data.quota && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Uso de Cota</h3>
                <div className="flex justify-between text-sm mb-1">
                  <span>Questões: {trackingDialog.data.quota.questions_used} / {trackingDialog.data.quota.questions_limit}</span>
                  <span className="text-muted-foreground">{Math.round((trackingDialog.data.quota.questions_used / Math.max(trackingDialog.data.quota.questions_limit, 1)) * 100)}%</span>
                </div>
                <Progress value={(trackingDialog.data.quota.questions_used / Math.max(trackingDialog.data.quota.questions_limit, 1)) * 100} className="h-2" />
              </div>
            )}

            {trackingDialog.data.domainMap?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Brain className="h-4 w-4" /> Domínio por Especialidade</h3>
                <div className="space-y-2.5">
                  {trackingDialog.data.domainMap.slice(0, 10).map((d: any) => (
                    <div key={d.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{d.specialty}</span>
                        <span className="text-muted-foreground">{Math.round(d.domain_score)}% • {d.questions_answered} questões</span>
                      </div>
                      <Progress value={d.domain_score} className={`h-1.5 ${d.domain_score < 50 ? "[&>div]:bg-destructive" : d.domain_score < 70 ? "[&>div]:bg-amber-500" : ""}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trackingDialog.data.examSessions?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><ClipboardList className="h-4 w-4" /> Últimos Simulados</h3>
                <div className="space-y-2">
                  {trackingDialog.data.examSessions.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-sm px-3 py-2 rounded bg-secondary/50">
                      <div>
                        <span className="font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(e.started_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.score != null && (
                          <Badge variant={e.score >= 70 ? "default" : "destructive"} className="text-xs">
                            {Math.round(e.score)}%
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {e.status === "finished" ? "Finalizado" : "Em andamento"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trackingDialog.data.errorBank?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Principais Erros</h3>
                <div className="space-y-1.5">
                  {trackingDialog.data.errorBank.slice(0, 8).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-secondary/50">
                      <span>{e.tema}{e.subtema ? ` → ${e.subtema}` : ""}</span>
                      <Badge variant="destructive" className="text-xs">{e.vezes_errado}x</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trackingDialog.data.diagnostic && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Diagnóstico Inicial</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span>Nota: <strong>{trackingDialog.data.diagnostic.score}/{trackingDialog.data.diagnostic.total_questions}</strong></span>
                  <span className="text-muted-foreground">({Math.round((trackingDialog.data.diagnostic.score / Math.max(trackingDialog.data.diagnostic.total_questions, 1)) * 100)}%)</span>
                  <span className="text-xs text-muted-foreground">em {new Date(trackingDialog.data.diagnostic.completed_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            )}

            {trackingDialog.data.profile && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2">Informações do Perfil</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {trackingDialog.data.profile.target_specialty && (
                    <div><span className="text-muted-foreground">Especialidade alvo:</span> {trackingDialog.data.profile.target_specialty}</div>
                  )}
                  {trackingDialog.data.profile.exam_date && (
                    <div><span className="text-muted-foreground">Data da prova:</span> {new Date(trackingDialog.data.profile.exam_date).toLocaleDateString("pt-BR")}</div>
                  )}
                  {trackingDialog.data.profile.daily_study_hours && (
                    <div><span className="text-muted-foreground">Horas/dia:</span> {trackingDialog.data.profile.daily_study_hours}h</div>
                  )}
                  <div><span className="text-muted-foreground">Diagnóstico:</span> {trackingDialog.data.profile.has_completed_diagnostic ? "✅ Completo" : "❌ Pendente"}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado.</p>
        )}
      </DialogContent>
    </Dialog>

    {/* Module Access Dialog */}
    <Dialog open={accessDialog.open} onOpenChange={(open) => !open && setAccessDialog({ open: false, user: null, modules: {}, loading: false, saving: false })}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Controle de Acessos — {accessDialog.user?.display_name || accessDialog.user?.email}
          </DialogTitle>
          <DialogDescription>Ative ou desative módulos para este usuário.</DialogDescription>
        </DialogHeader>

        {accessDialog.loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {ALL_MODULES.map((mod) => (
              <div key={mod.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50">
                <span className="text-sm font-medium">{mod.label}</span>
                <Switch
                  checked={accessDialog.modules[mod.key] ?? true}
                  disabled={mod.key === "dashboard"}
                  onCheckedChange={(checked) =>
                    setAccessDialog((prev: any) => ({
                      ...prev,
                      modules: { ...prev.modules, [mod.key]: checked }
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAccessDialog({ open: false, user: null, modules: {}, loading: false, saving: false })}>Cancelar</Button>
          <Button onClick={handleSaveAccess} disabled={accessDialog.loading || accessDialog.saving}>
            {accessDialog.saving ? "Salvando..." : "Salvar acessos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete User Dialog */}
    <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Excluir usuário permanentemente
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-destructive">Atenção: esta ação é irreversível!</span> Todos os dados de "{deleteDialog.user?.display_name || deleteDialog.user?.email}" serão permanentemente excluídos, incluindo questões, simulados, flashcards, histórico e progresso.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDeleteUser} disabled={!!actionLoading} className="gap-1.5">
            <Trash2 className="h-4 w-4" /> Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
};

export default AdminDialogs;
