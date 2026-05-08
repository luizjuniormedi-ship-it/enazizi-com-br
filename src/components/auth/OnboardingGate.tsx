/**
 * OnboardingGate — Sprint 1 split from the old ProtectedRoute monolith.
 *
 * Owns ONLY the user-facing flows that depend on profile status:
 *   • Blocked screen
 *   • Pending-approval screen
 *   • Disabled screen
 *   • Inline "complete your profile" form
 *   • V2 Welcome + V2 Onboarding flow
 *
 * It does NOT decide auth, that is ProtectedRoute's job. It receives the
 * resolved status from useProfileStatus and renders the matching screen.
 * If status is "ready", it just renders children.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LogOut,
  Clock,
  Save,
  Loader2,
  GraduationCap,
  Building,
  Phone,
  User,
  Stethoscope,
  Target,
} from "lucide-react";
import FaculdadeCombobox from "@/components/FaculdadeCombobox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { isValidPhone, isValidName } from "@/lib/profileValidation";
import { EXAM_PROFILES } from "@/lib/examProfiles";
import WelcomeBackScreen from "@/components/onboarding/WelcomeBackScreen";
import OnboardingV2Flow from "@/components/onboarding/OnboardingV2Flow";

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const { kind, profile, refresh } = useProfileStatus();
  const { toast } = useToast();

  const [formName, setFormName] = useState(profile?.display_name ?? "");
  const [formPhone, setFormPhone] = useState(profile?.phone ?? "");
  const [formPeriodo, setFormPeriodo] = useState(profile?.periodo ? String(profile.periodo) : "");
  const [formFaculdade, setFormFaculdade] = useState(profile?.faculdade ?? "");
  const [formUserType, setFormUserType] = useState(profile?.user_type ?? "estudante");
  const [formTargetExams, setFormTargetExams] = useState<string[]>(profile?.target_exams ?? []);
  const [saving, setSaving] = useState(false);

  if (kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (kind === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8 max-w-sm">
          <h1 className="text-xl font-bold">Não foi possível carregar seu perfil</h1>
          <p className="text-muted-foreground text-sm">
            Verifique sua conexão e tente novamente.
          </p>
          <Button onClick={() => refresh()}>Tentar novamente</Button>
          <Button variant="ghost" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="text-5xl">🚫</div>
          <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
          <p className="text-muted-foreground max-w-md">
            Sua conta foi bloqueada pelo administrador. Entre em contato com o suporte para mais informações.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "incomplete") {
    const isMedico = formUserType === "medico";
    const isStudent = formUserType === "estudante" || isMedico;
    const isProfessor = formUserType === "professor";

    const handleSave = async () => {
      if (!user) return;
      const trimmedName = formName.trim();

      const nameCheck = isValidName(trimmedName);
      if (!nameCheck.valid) {
        toast({ title: nameCheck.message || "Nome inválido", variant: "destructive" });
        return;
      }
      const phoneCheck = isValidPhone(formPhone);
      if (!phoneCheck.valid) {
        toast({ title: phoneCheck.message || "Telefone inválido", variant: "destructive" });
        return;
      }
      if (isStudent && !formPeriodo) {
        toast({ title: "Selecione o seu período", variant: "destructive" });
        return;
      }
      if (!formFaculdade) {
        toast({ title: "Selecione sua universidade", variant: "destructive" });
        return;
      }
      if (isStudent && formTargetExams.length === 0) {
        toast({ title: "Escolha ao menos uma banca de estudo", variant: "destructive" });
        return;
      }

      const cleanPhone = formPhone.replace(/\D/g, "");
      setSaving(true);
      try {
        const updateData: TablesUpdate<"profiles"> = {
          display_name: trimmedName,
          phone: cleanPhone,
          user_type: formUserType,
          faculdade: formFaculdade,
        };
        if (isStudent) {
          updateData.periodo = parseInt(formPeriodo);
          updateData.target_exams = formTargetExams;
          updateData.target_exam = formTargetExams[0];
        }
        if (isProfessor || isMedico) {
          await supabase.from("user_roles").upsert(
            { user_id: user.id, role: "professor" as any },
            { onConflict: "user_id,role" }
          );
        }
        const { error } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("user_id", user.id);
        if (error) throw error;

        toast({ title: "Cadastro completo! 🎉" });
        // Side effect: bootstrap default simulados. Captured & logged, never silent.
        try {
          await supabase.functions.invoke("auto-assign-simulados");
        } catch (autoErr) {
          console.warn("[OnboardingGate] auto-assign-simulados failed:", autoErr);
        }
        refresh();
      } catch (err: any) {
        toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="min-h-[100dvh] overflow-y-auto flex items-start sm:items-center justify-center bg-background p-4 py-8">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Complete seu cadastro</h1>
            <p className="text-muted-foreground text-sm">
              Para acessar a plataforma, preencha todas as informações abaixo.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome completo
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Eu sou</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "estudante", icon: GraduationCap, label: "Estudante" },
                  { key: "professor", icon: Building, label: "Professor" },
                  { key: "medico", icon: Stethoscope, label: "Médico" },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormUserType(key)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                      formUserType === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                WhatsApp
              </Label>
              <Input
                value={formPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                  if (digits.length > 7)
                    formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                  setFormPhone(formatted);
                }}
                placeholder="(21) 99999-9999"
                maxLength={16}
              />
            </div>

            {formUserType === "estudante" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    Período
                  </Label>
                  <Select value={formPeriodo} onValueChange={setFormPeriodo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p}º período
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                    Faculdade
                  </Label>
                  <FaculdadeCombobox value={formFaculdade} onChange={setFormFaculdade} />
                </div>
              </div>
            )}

            {(formUserType === "professor" || formUserType === "medico") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Universidade
                </Label>
                <FaculdadeCombobox value={formFaculdade} onChange={setFormFaculdade} />
              </div>
            )}

            {(formUserType === "estudante" || formUserType === "medico") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  Banca(s) de estudo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais bancas que pretende prestar.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {Object.values(EXAM_PROFILES).map((p) => {
                    const active = formTargetExams.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() =>
                          setFormTargetExams((prev) =>
                            prev.includes(p.key)
                              ? prev.filter((k) => k !== p.key)
                              : [...prev, p.key]
                          )
                        }
                        className={`p-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Salvar e acessar
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-2 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">Aguardando Aprovação</h1>
          <p className="text-muted-foreground">
            Sua conta está aguardando aprovação do administrador. Você receberá acesso assim que for aprovado.
          </p>
          <div className="pt-4">
            <Button variant="outline" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "disabled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-5xl">❌</div>
          <h1 className="text-2xl font-bold text-destructive">Conta Rejeitada</h1>
          <p className="text-muted-foreground">
            Sua solicitação de acesso foi rejeitada pelo administrador. Entre em contato com o suporte se acredita que isso é um erro.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "needs_welcome") {
    return (
      <WelcomeBackScreen
        onStart={() => {
          localStorage.setItem("enazizi_v2_welcome_seen", "true");
          refresh();
        }}
        onSkip={async () => {
          if (user) {
            try {
              await supabase
                .from("profiles")
                .update({
                  onboarding_version: 2,
                  experience_reset_at: new Date().toISOString(),
                  last_onboarding_step: 0,
                  daily_study_hours: 4,
                })
                .eq("user_id", user.id);
            } catch {}
          }
          localStorage.setItem("enazizi_v2_welcome_seen", "true");
          localStorage.setItem("enazizi_v2_onboarding_done", "true");
          localStorage.setItem("enazizi_exam_setup_skipped", "true");
          refresh();
        }}
      />
    );
  }

  if (kind === "needs_onboarding_v2") {
    return (
      <OnboardingV2Flow
        onComplete={() => {
          localStorage.setItem("enazizi_v2_onboarding_done", "true");
          refresh();
        }}
        onSkip={async () => {
          if (user) {
            try {
              await supabase
                .from("profiles")
                .update({
                  onboarding_version: 2,
                  experience_reset_at: new Date().toISOString(),
                  last_onboarding_step: 0,
                  daily_study_hours: 4,
                })
                .eq("user_id", user.id);
            } catch {}
          }
          localStorage.setItem("enazizi_v2_welcome_seen", "true");
          localStorage.setItem("enazizi_v2_onboarding_done", "true");
          localStorage.setItem("enazizi_exam_setup_skipped", "true");
          refresh();
        }}
      />
    );
  }

  // ready
  return <>{children}</>;
};

export default OnboardingGate;
