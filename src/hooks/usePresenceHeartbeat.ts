import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

const HEARTBEAT_INTERVAL = 30_000; // 30s para maior precisão enterprise

export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  // Keep ref updated without resetting interval
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      // Upsert presence legada
      await supabase.from("user_presence" as any).upsert(
        {
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
          current_page: pathnameRef.current,
        } as any,
        { onConflict: "user_id" }
      );

      // Metria de Cluster (Fase Enterprise+)
      // Registra que um usuário está ativo no "cluster" para o Auto Scaling saber a carga real
      try {
        await supabase.from("cme_cluster_metrics").insert({
          active_workers: 0, // Apenas para trigger de análise de carga de usuários
          queued_jobs: 0,
          vram_utilization: 0,
          cpu_utilization: 0
        });
      } catch (e) {
        // Silencioso se falhar, não é crítico para o usuário
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);
}
