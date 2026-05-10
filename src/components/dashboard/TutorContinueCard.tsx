/**
 * TutorContinueCard
 * ─────────────────
 * Mostra a última conversa do Tutor IA (chat_conversations + última mensagem)
 * com CTA "Continuar de onde parou". Reduz fricção pra o usuário voltar
 * pro fluxo de estudo logo no Dashboard.
 *
 * NÃO escreve no backend. Apenas leitura.
 * Não renderiza se não houver conversa nas últimas 7 dias.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useCoreData } from "@/hooks/useCoreData";

interface LastSession {
  conversationId: string;
  title: string | null;
  updatedAt: string;
  preview: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

export default function TutorContinueCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackAction } = useTelemetry();
  const { data: coreData } = useCoreData();
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;
  const [session, setSession] = useState<LastSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
        let query = supabase
          .from("chat_conversations")
          .select("id, title, updated_at, agent_type")
          .eq("user_id", user.id)
          .eq("agent_type", "chatgpt-agent")
          .gte("updated_at", sevenDaysAgoIso);

        if (resetAt) query = query.gt("updated_at", resetAt);

        const { data: conv } = await query
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (import.meta.env.DEV) {
          console.log("[RESET-DEBUG]", { component: "TutorContinueCard", source: "chat_conversations", resetAt, data: conv });
        }

        if (cancelled || !conv) {
          if (!cancelled) setLoaded(true);
          return;
        }

        // Última mensagem do user (ou assistant) p/ preview
        const { data: msg } = await supabase
          .from("chat_messages")
          .select("content, role, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        setSession({
          conversationId: conv.id,
          title: conv.title,
          updatedAt: conv.updated_at,
          preview: msg?.content ? String(msg.content).replace(/[#*_~`]/g, '').replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF]/g, '').slice(0, 120) : null,
        });
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, resetAt]);

  if (!loaded || !session) return null;

  return (
    <Card className="overflow-hidden border-white/5 bg-card/40 backdrop-blur-sm shadow-sm rounded-2xl">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4 flex-1">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary shrink-0 shadow-glow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[15px] font-bold tracking-tight truncate">
                {session.title || "Conversa com o Tutor"}
              </span>
              <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-white/10 text-muted-foreground shrink-0 rounded-md">
                {timeAgo(session.updatedAt)}
              </Badge>
            </div>
            {session.preview && (
              <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground/80 font-medium">
                {session.preview}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-primary/20 text-primary font-bold hover:bg-primary/5 rounded-xl h-10 px-4 transition-all hover:scale-[1.02]"
          onClick={() => {
            trackAction('tutor_continue_clicked', { conversation_id: session.conversationId });
            navigate(`/dashboard/tutor-v2?conversation=${session.conversationId}&source=dashboard_continue`);
          }}
        >
          Retomar conversa
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
