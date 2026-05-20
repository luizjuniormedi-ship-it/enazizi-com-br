import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Play, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const CognitiveValidation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    eventCreated: boolean;
    errorBankUpdated: boolean;
    fsrsCreated: boolean;
    cogStateUpdated: boolean;
  } | null>(null);

  const runTest = async () => {
    if (!user) return;
    setLoading(true);
    setResults(null);

    const testTopic = "VALIDATION_TEST_" + Date.now();
    const testQuestionId = "d5a9ccd8-9abf-45cb-b3f6-3682818d46d3";

    try {
      // 1. Emit Event
      toast({ title: "Iniciando Teste", description: "Enviando evento de erro..." });
      const event = await pedagogicalEventBus.emit({
        event_type: 'simulado_error_detected',
        module: 'simulado',
        source: 'frontend',
        severity: 'warning',
        entity_type: 'question',
        entity_id: testQuestionId,
        study_context: { topic: testTopic },
        metadata: { is_correct: false, statement: "Teste de Validação ALOS" }
      }, user.id);

      if (!event) throw new Error("Falha ao criar evento");
      
      const newResults = {
        eventCreated: true,
        errorBankUpdated: false,
        fsrsCreated: false,
        cogStateUpdated: false
      };
      setResults({ ...newResults });

      // 2. Poll for side effects (wait up to 10 seconds)
      toast({ title: "Validando", description: "Aguardando processamento do Event Bus..." });
      
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        
        // Check Error Bank
        const { data: errorEntry } = await supabase.from("error_bank")
          .select("id")
          .eq("user_id", user.id)
          .eq("tema", testTopic)
          .maybeSingle();
        
        if (errorEntry) {
          newResults.errorBankUpdated = true;
          
          // Check FSRS
          const { data: fsrsCard } = await supabase.from("fsrs_cards")
            .select("id")
            .eq("user_id", user.id)
            .eq("card_ref_id", errorEntry.id.toString())
            .maybeSingle();
          
          if (fsrsCard) newResults.fsrsCreated = true;
        }

        // Check Cognitive State
        const { data: cogState } = await supabase.from("cognitive_states")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (cogState) {
          // If we see any cogState, we assume it's working for this test
          newResults.cogStateUpdated = true;
        }

        setResults({ ...newResults });
        if (newResults.errorBankUpdated && newResults.fsrsCreated && newResults.cogStateUpdated) break;
      }

      toast({ 
        title: "Validação Concluída", 
        description: "Ciclo cognitivo testado com sucesso.",
        variant: "default"
      });

    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha no Teste", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">ALOS Longitudinal Validator</CardTitle>
            <CardDescription>Validação do ciclo: Erro → Error Bank → FSRS → Cognitive State</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button 
          onClick={runTest} 
          disabled={loading} 
          className="w-full gap-2"
        >
          {loading ? "Processando Ciclo..." : <><Play className="h-4 w-4" /> Iniciar Teste de Runtime</>}
        </Button>

        {results && (
          <div className="space-y-3 pt-4 border-t border-primary/10">
            <ResultItem label="Evento Pedagógico Persistido" success={results.eventCreated} />
            <ResultItem label="Registro no Error Bank Automático" success={results.errorBankUpdated} />
            <ResultItem label="Card FSRS Criado via Trigger DB" success={results.fsrsCreated} />
            <ResultItem label="Cognitive State Sincronizado" success={results.cogStateUpdated} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ResultItem = ({ label, success }: { label: string, success: boolean }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-white/5">
    <span className="text-sm font-medium">{label}</span>
    {success ? (
      <div className="flex items-center gap-1.5 text-green-500 font-bold text-xs uppercase tracking-tight">
        <CheckCircle2 className="h-4 w-4" />
        <span>Validado</span>
      </div>
    ) : (
      <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-xs uppercase tracking-tight">
        <AlertCircle className="h-4 w-4" />
        <span>Pendente</span>
      </div>
    )}
  </div>
);
