import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  resetUserStudyPlan,
  PLAN_RELATED_QUERY_KEYS,
} from "@/lib/resetUserStudyPlan";

const CONFIRM_WORD = "RESETAR";

interface Props {
  userId: string;
}

export function ResetStudyPlanSection({ userId }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const handleReset = async () => {
    if (!canConfirm || resetting) return;
    setResetting(true);

    const result = await resetUserStudyPlan(userId);

    setResetting(false);

    if (!result.success) {
      toast({
        title: "Não foi possível resetar o plano",
        description:
          result.error ??
          "Ocorreu um erro inesperado. Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    // Invalidar TODAS as queries relacionadas ao plano (lista canônica
    // mantida em sync com useRefreshUserState).
    // 1) removeQueries → descarta cache em memória (incl. dados servidos
    //    pelo fast-path de snapshot já hidratado).
    // 2) invalidateQueries → marca como stale e força refetch para queries
    //    montadas no momento (ex.: dashboard ainda visível ao retornar).
    try {
      for (const key of PLAN_RELATED_QUERY_KEYS) {
        queryClient.removeQueries({ queryKey: [key] });
      }
      await Promise.all(
        PLAN_RELATED_QUERY_KEYS.map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      );
    } catch {}

    setOpen(false);
    setConfirmText("");

    toast({
      title: "Plano resetado",
      description: result.regenerated
        ? "Seu plano foi reconstruído do zero. Bons estudos!"
        : "Plano apagado. Um novo será montado ao abrir o painel.",
    });

    navigate("/dashboard");
  };

  return (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Resetar plano de estudo</p>
          <p className="text-xs text-muted-foreground">
            Apaga o plano atual, as tarefas atribuídas e o progresso planejado
            do dia. Em seguida, gera um novo plano do zero.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Não afeta:</strong> seu histórico de respostas, banco de
            erros, revisões (FSRS), simulados realizados e desempenho histórico.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Resetar plano de estudo
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => { if (!resetting) setOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar reset do plano
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Esta ação <strong>apaga seu plano de estudo atual</strong>,
                  todas as tarefas atribuídas e o progresso planejado.
                </p>
                <p className="text-muted-foreground">
                  Seu histórico de respostas, banco de erros, revisões e
                  simulados <strong>não serão apagados</strong>.
                </p>
                <p>
                  Para confirmar, digite{" "}
                  <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">
                    {CONFIRM_WORD}
                  </code>{" "}
                  abaixo:
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm" className="sr-only">
              Confirmação
            </Label>
            <Input
              id="reset-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              disabled={resetting}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReset();
              }}
              disabled={!canConfirm || resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar agora
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
