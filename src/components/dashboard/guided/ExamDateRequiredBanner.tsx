/**
 * ExamDateRequiredBanner — Coleta elegante de exam_date
 * ─────────────────────────────────────────────────────
 * Banner persistente no Dashboard quando o usuário não tem `exam_date`.
 * Permite preencher inline OU marcar "ainda não sei" (mas continua avisando).
 *
 * Atualiza profiles.exam_date diretamente. Sem migração nova.
 */
import { useState, useEffect } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCoreData } from "@/hooks/useCoreData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SNOOZE_KEY = "exam_date_banner_snoozed_until";

export default function ExamDateRequiredBanner() {
  const { user } = useAuth();
  const { data: coreData, isLoading } = useCoreData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [examDate, setExamDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [snoozedTick, setSnoozedTick] = useState(0);

  // Re-evaluate snooze on mount
  useEffect(() => { setSnoozedTick(Date.now()); }, []);

  if (isLoading || !user || !coreData) return null;
  if (coreData.profile.exam_date) return null;

  // Snooze leve — 24h após "ainda não sei", ainda assim volta a aparecer depois
  const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
  if (snoozedUntil > Date.now() && snoozedTick > 0) return null;

  const save = async () => {
    if (!examDate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ exam_date: examDate })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Data salva", description: "Seu plano será adaptado à proximidade da prova." });
      queryClient.invalidateQueries({ queryKey: ["core-data"] });
      queryClient.invalidateQueries({ queryKey: ["study-engine-impact"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dontKnow = () => {
    // Esconde por 24h, mas volta a aparecer depois
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setOpen(false);
    setSnoozedTick(Date.now());
  };

  return (
    <div className="glass-card p-4 border-2 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground">
            Informe a data da sua prova
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Para personalizar seu plano até a prova, o motor precisa saber quando você vai fazer.
          </p>

          {!open ? (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
                Definir agora
              </Button>
              <Button size="sm" variant="ghost" onClick={dontKnow}>
                Ainda não sei
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="h-9 max-w-[200px]"
                min={new Date().toISOString().slice(0, 10)}
              />
              <Button size="sm" onClick={save} disabled={!examDate || saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
