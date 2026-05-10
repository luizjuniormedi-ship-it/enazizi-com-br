/**
 * StartHereCard
 * ─────────────
 * Cabeçalho do GuidedFlowLayer. Sempre visível.
 * - Sem conversa: "Começar agora" → abre Tutor.
 * - Com conversa recente (≤7d): "Continuar de onde parou".
 *
 * Apenas leitura (chat_conversations). Não escreve no backend.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MessageSquare, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface LastConversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export default function StartHereCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [last, setLast] = useState<LastConversation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
        const { data } = await supabase
          .from("chat_conversations")
          .select("id, title, updated_at")
          .eq("user_id", user.id)
          .eq("agent_type", "chatgpt-agent")
          .gte("updated_at", sinceIso)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (data) {
          setLast({ id: data.id, title: data.title, updatedAt: data.updated_at });
        }
      } catch {
        /* silencioso */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isContinue = !!last;
  const handleClick = () => {
    if (isContinue && last) {
      navigate(`/dashboard/mentor?conversation=${last.id}&source=guided_start`);
    } else {
      navigate("/dashboard/mentor?source=guided_start");
    }
  };

  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3 flex-1">
          <div className="rounded-lg bg-primary/15 p-2 text-primary shrink-0">
            {isContinue ? <MessageSquare className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {isContinue ? "Continuar de onde parou" : "Começar agora com o Tutor"}
              </span>
              {isContinue && last && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {timeAgo(last.updatedAt)}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {isContinue
                ? last?.title || "Sua última conversa com o Tutor"
                : "Tire dúvidas, peça um plano ou comece a estudar com orientação."}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleClick} className="shrink-0 self-start sm:self-auto" disabled={!loaded && !isContinue ? false : false}>
          {isContinue ? "Continuar" : "Começar"}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
