import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useWeeklyGoals } from "@/hooks/useWeeklyGoals";
import { supabase } from "@/integrations/supabase/client";
import { Settings2, Target, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hapticSuccess } from "@/lib/haptics";

interface PersonalGoals {
  questoes_dia: number;
  revisoes_dia: number;
  horas_estudo: number;
  temas_semana: number;
}

const DEFAULTS: PersonalGoals = {
  questoes_dia: 30,
  revisoes_dia: 5,
  horas_estudo: 3,
  temas_semana: 5,
};

export default function PersonalGoalsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: weeklyData } = useWeeklyGoals();
  const [goals, setGoals] = useState<PersonalGoals>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonalGoals>(DEFAULTS);

  // Load from localStorage (lightweight, no DB needed)
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`personal_goals_${user.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setGoals(parsed);
        setDraft(parsed);
      } catch {}
    }
  }, [user]);

  const saveGoals = useCallback(() => {
    if (!user) return;
    localStorage.setItem(`personal_goals_${user.id}`, JSON.stringify(draft));
    setGoals(draft);
    setEditing(false);
    hapticSuccess();
    toast({ title: "Metas atualizadas!", description: "Suas metas pessoais foram salvas." });
  }, [user, draft, toast]);

  // Derive daily progress from weekly data
  const dailyQuestions = weeklyData
    ? Math.round(weeklyData.goals.find(g => g.key === "questoes")?.current ?? 0) / 7
    : 0;
  const dailyRevisoes = weeklyData
    ? Math.round(weeklyData.goals.find(g => g.key === "revisoes")?.current ?? 0) / 7
    : 0;

  const items = [
    { label: "Questões/dia", icon: "📝", current: Math.round(dailyQuestions), target: goals.questoes_dia },
    { label: "Revisões/dia", icon: "🔄", current: Math.round(dailyRevisoes), target: goals.revisoes_dia },
    { label: "Temas/semana", icon: "📚", current: weeklyData?.goals.find(g => g.key === "temas")?.current ?? 0, target: goals.temas_semana },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Minhas Metas</span>
          </div>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Configurar Metas
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Questões por dia: {draft.questoes_dia}</Label>
                  <Slider
                    value={[draft.questoes_dia]}
                    onValueChange={([v]) => setDraft(d => ({ ...d, questoes_dia: v }))}
                    min={5} max={100} step={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Revisões por dia: {draft.revisoes_dia}</Label>
                  <Slider
                    value={[draft.revisoes_dia]}
                    onValueChange={([v]) => setDraft(d => ({ ...d, revisoes_dia: v }))}
                    min={1} max={30} step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Horas de estudo/dia: {draft.horas_estudo}</Label>
                  <Slider
                    value={[draft.horas_estudo]}
                    onValueChange={([v]) => setDraft(d => ({ ...d, horas_estudo: v }))}
                    min={1} max={12} step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Temas novos/semana: {draft.temas_semana}</Label>
                  <Slider
                    value={[draft.temas_semana]}
                    onValueChange={([v]) => setDraft(d => ({ ...d, temas_semana: v }))}
                    min={1} max={15} step={1}
                  />
                </div>
                <Button onClick={saveGoals} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Metas
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2.5">
          {items.map(item => {
            const pct = item.target > 0 ? Math.min(Math.round((item.current / item.target) * 100), 100) : 0;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{item.icon}</span> {item.label}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    {item.current}/{item.target}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
