import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TutorV2ChatPanel from "@/components/tutor-v2/TutorV2ChatPanel";
import TutorV2Sidebar from "@/components/tutor-v2/TutorV2Sidebar";
import { useToast } from "@/components/ui/use-toast";

export default function TutorV2Page() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !user) return;

    const fetchSession = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        toast({
          title: "Erro ao carregar sessão",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setSession(data);
      setIsLoading(false);
    };

    fetchSession();
  }, [sessionId, user]);

  if (isLoading) return <div className="flex items-center justify-center h-screen">Carregando Tutor V2...</div>;

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <TutorV2Sidebar session={session} />
      <main className="flex-1 relative flex flex-col min-w-0">
        <TutorV2ChatPanel session={session} />
      </main>
    </div>
  );
}
