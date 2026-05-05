import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { LogOut, Clock, Save, Loader2, GraduationCap, Building, Phone, User, Stethoscope, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FACULDADES } from "@/constants/faculdades";
import FaculdadeCombobox from "@/components/FaculdadeCombobox";
import { isValidPhone, isValidName, isProfileComplete } from "@/lib/profileValidation";
import WelcomeBackScreen from "@/components/onboarding/WelcomeBackScreen";
import OnboardingV2Flow from "@/components/onboarding/OnboardingV2Flow";
import { EXAM_PROFILES } from "@/lib/examProfiles";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [onboardingVersion, setOnboardingVersion] = useState<number>(2);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPeriodo, setFormPeriodo] = useState("");
  const [formFaculdade, setFormFaculdade] = useState("");
  const [formUserType, setFormUserType] = useState("estudante");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const RESET_VERSION = "4";
    if (localStorage.getItem("enazizi_onboarding_reset_v") !== RESET_VERSION) {
      localStorage.removeItem("enazizi_v2_welcome_seen");
      localStorage.removeItem("enazizi_v2_onboarding_done");
      localStorage.removeItem("enazizi_exam_setup_skipped");
      localStorage.setItem("enazizi_onboarding_reset_v", RESET_VERSION);
    }

    if (!user) {
      setCheckingProfile(false);
      return;
    }

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_blocked, status, display_name, phone, periodo, faculdade, onboarding_version, user_type")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.is_blocked) {
          setProfileStatus("blocked");
          setCheckingProfile(false);
          return;
        }

        const userType = data?.user_type || "estudante";
        const incomplete = !isProfileComplete({
          phone: data?.phone,
          display_name: data?.display_name,
          periodo: data?.periodo,
          faculdade: data?.faculdade,
          user_type: userType,
        });

        setProfileIncomplete(incomplete);
        if (incomplete) {
          setFormName(data?.display_name || "");
          setFormPhone(data?.phone || "");
          setFormPeriodo(data?.periodo ? String(data.periodo) : "");
          setFormFaculdade(data?.faculdade || "");
          setFormUserType(userType);
        }

        const currentStatus = data?.status || "pending";
        // Auto-activate pending professors if profile is complete
        if (userType === "professor" && !incomplete && currentStatus === "pending") {
          await supabase.from("profiles").update({ status: "active" }).eq("user_id", user.id);
          setProfileStatus("active");
        } else {
          setProfileStatus(currentStatus);
        }

        const obVersion = (data as any)?.onboarding_version ?? 1;
        setOnboardingVersion(obVersion);

        // V2 Onboarding Logic
        if (obVersion < 2 && !incomplete && (currentStatus === "active" || (userType === "professor" && !incomplete))) {
          const welcomeSeen = localStorage.getItem("enazizi_v2_welcome_seen") === "true";
          const onboardingDone = localStorage.getItem("enazizi_v2_onboarding_done") === "true";
          if (!welcomeSeen) setShowWelcome(true);
          else if (!onboardingDone) setShowOnboarding(true);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setCheckingProfile(false);
      }
    };

    check();
  }, [user]);

  const handleOnboardingSave = async () => {
    if (!user) return;

    const trimmedName = formName.trim();
    const isMedico = formUserType === "medico";
    const isStudent = formUserType === "estudante" || isMedico;
    const isProfessor = formUserType === "professor";

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

    if (isStudent && (!formPeriodo || !formFaculdade)) {
      toast({ title: "Selecione período e faculdade", variant: "destructive" });
      return;
    }

    if (isProfessor && !formFaculdade) {
      toast({ title: "Selecione sua universidade", variant: "destructive" });
      return;
    }

    const cleanPhone = formPhone.replace(/\D/g, "");
    setSaving(true);

    try {
      const updateData: TablesUpdate<"profiles"> = {
        display_name: trimmedName,
        phone: cleanPhone,
        user_type: formUserType,
      };

      if (isStudent) {
        updateData.periodo = parseInt(formPeriodo);
        updateData.faculdade = formFaculdade;
      }

      if (isProfessor || isMedico) {
        updateData.faculdade = formFaculdade;
        if (isProfessor) updateData.status = "active";
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
      setProfileIncomplete(false);
      toast({ title: "Cadastro completo! 🎉" });
      supabase.functions.invoke("auto-assign-simulados").catch(() => {});
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profileStatus === "blocked") {
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

  // Force onboarding BEFORE showing pending/approval screen
  if (profileIncomplete) {
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
                <button
                  type="button"
                  onClick={() => setFormUserType("estudante")}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${formUserType === "estudante" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-accent"}`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Estudante
                </button>
                <button
                  type="button"
                  onClick={() => setFormUserType("professor")}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${formUserType === "professor" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-accent"}`}
                >
                  <Building className="h-4 w-4" />
                  Professor
                </button>
                <button
                  type="button"
                  onClick={() => setFormUserType("medico")}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${formUserType === "medico" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-accent"}`}
                >
                  <Stethoscope className="h-4 w-4" />
                  Médico
                </button>
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
                  if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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
                        <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
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

            {formUserType === "professor" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Universidade
                </Label>
                <FaculdadeCombobox value={formFaculdade} onChange={setFormFaculdade} />
              </div>
            )}

            <Button onClick={handleOnboardingSave} disabled={saving} className="w-full mt-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Salvar e acessar</>
              )}
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (profileStatus === "pending") {
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

  if (profileStatus === "disabled") {
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

  const handleSkipOnboarding = async () => {
    if (!user) return;
    try {
      await supabase.from("profiles").update({
        onboarding_version: 2,
        experience_reset_at: new Date().toISOString(),
        last_onboarding_step: 0,
        daily_study_hours: 4,
      }).eq("user_id", user.id);
    } catch {}
    localStorage.setItem("enazizi_v2_welcome_seen", "true");
    localStorage.setItem("enazizi_v2_onboarding_done", "true");
    localStorage.setItem("enazizi_exam_setup_skipped", "true");
    setShowWelcome(false);
    setShowOnboarding(false);
    setOnboardingVersion(2);
  };

  // V2 Welcome screen for existing users
  if (showWelcome) {
    return (
      <WelcomeBackScreen
        onStart={() => {
          localStorage.setItem("enazizi_v2_welcome_seen", "true");
          setShowWelcome(false);
          setShowOnboarding(true);
        }}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  // V2 Onboarding flow
  if (showOnboarding) {
    return (
      <OnboardingV2Flow
        onComplete={() => {
          setShowOnboarding(false);
          setOnboardingVersion(2);
        }}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
