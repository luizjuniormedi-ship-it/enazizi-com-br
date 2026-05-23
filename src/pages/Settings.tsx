import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Bell, Moon, Sun, Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [studyReminders, setStudyReminders] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp_opt_out, whatsapp_daily_bi")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setNotifications(!(data as any).whatsapp_opt_out);
        setStudyReminders((data as any).whatsapp_daily_bi ?? true);
      }
    };
    load();
  }, [user]);

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        whatsapp_opt_out: !notifications,
        whatsapp_daily_bi: studyReminders,
      } as any).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Preferências salvas" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="text-center py-4">
        <SettingsIcon className="h-10 w-10 text-primary mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua experiência no ENAZIZI</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Moon className="h-4 w-4" /> Aparência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Tema escuro</Label>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações gerais</Label>
              <p className="text-sm text-muted-foreground">Receber avisos do sistema</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Lembretes de estudo</Label>
              <p className="text-sm text-muted-foreground">Lembrar de revisar flashcards e completar plano</p>
            </div>
            <Switch checked={studyReminders} onCheckedChange={setStudyReminders} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={savePreferences} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar preferências"}
      </Button>
    </div>
  );
};

export default Settings;
