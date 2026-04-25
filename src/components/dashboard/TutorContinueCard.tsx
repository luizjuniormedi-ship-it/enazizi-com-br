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
  const [session, setSession] = useState<LastSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
        const { data: conv } = await supabase
          .from("chat_conversations")
          .select("id, title, updated_at, agent_type")
          .eq("user_id", user.id)
          .eq("agent_type", "chatgpt-agent")
          .gte("updated_at", sevenDaysAgoIso)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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
  }, [user]);

  if (!loaded || !session) return null;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3 flex-1">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {session.title || "Conversa com o Tutor"}
              </span>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {timeAgo(session.updatedAt)}
              </Badge>
            </div>
            {session.preview && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {session.preview}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-primary/20 text-primary hover:bg-primary/5"
          onClick={() => navigate(`/dashboard/sessao-estudo?conversation=${session.conversationId}&source=dashboard_continue`)}
        >
          Retomar conversa
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
