import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: { enabled: boolean; at: number } | null = null;
const TTL_MS = 60_000;

/**
 * Lê a flag `memory_consolidation_enabled` em `system_flags`.
 * Override local (dev/QA): localStorage.MCE_ENABLED = "on" | "shadow" | "off".
 * Modo shadow: card renderiza, mas advance_allowed NÃO bloqueia navegação.
 */
export function useMemoryConsolidationFlag() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [shadow, setShadow] = useState<boolean>(true); // default: shadow

  useEffect(() => {
    let cancelled = false;

    // Override local
    try {
      const ls = typeof window !== "undefined" ? window.localStorage.getItem("MCE_ENABLED") : null;
      if (ls === "on") { setEnabled(true); setShadow(false); return; }
      if (ls === "shadow") { setEnabled(true); setShadow(true); return; }
      if (ls === "off") { setEnabled(false); return; }
    } catch { /* noop */ }

    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) {
      setEnabled(cache.enabled);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from("system_flags")
          .select("enabled")
          .eq("flag_key", "memory_consolidation_enabled")
          .maybeSingle();
        const on = !!data?.enabled;
        cache = { enabled: on, at: Date.now() };
        if (!cancelled) setEnabled(on);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { enabled, shadow };
}
