/**
 * useEnaflixUsage — rastreia uso recente dos módulos do Enaflix.
 *
 * Sem backend: persiste em localStorage (key `enaflix:usage`).
 * Estrutura: { [moduleId]: { count, lastVisit (ISO) } }
 *
 * Expõe:
 *  - recordVisit(id)  → registra um clique
 *  - recent           → módulos visitados nas últimas 7 dias (mais recentes primeiro)
 *  - popular          → top módulos por contagem total
 */
import { useCallback, useEffect, useState } from "react";

type UsageMap = Record<string, { count: number; lastVisit: string }>;

const KEY = "enaflix:usage";

function read(): UsageMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UsageMap;
  } catch {
    return {};
  }
}

function write(map: UsageMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useEnaflixUsage() {
  const [usage, setUsage] = useState<UsageMap>({});

  useEffect(() => {
    setUsage(read());
  }, []);

  const recordVisit = useCallback((id: string) => {
    setUsage((prev) => {
      const cur = prev[id] ?? { count: 0, lastVisit: new Date().toISOString() };
      const next: UsageMap = {
        ...prev,
        [id]: { count: cur.count + 1, lastVisit: new Date().toISOString() },
      };
      write(next);
      return next;
    });
    // Marca a origem ENAFLIX para o botão flutuante "Voltar ao ENAFLIX"
    // aparecer em qualquer página de módulo até o usuário voltar/limpar.
    try {
      sessionStorage.setItem("enaflix:origin", "1");
      sessionStorage.setItem("enaflix:lastModule", id);
    } catch {
      // ignore
    }
    // Shadow Adaptive Layer (Fase 3A) — observacional, sem efeito na UX.
    void emitShadowEvent({ module: "enaflix", event: "watch_started", topic: id });
  }, []);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const recentIds = Object.entries(usage)
    .filter(([, v]) => new Date(v.lastVisit).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b[1].lastVisit).getTime() - new Date(a[1].lastVisit).getTime())
    .slice(0, 10)
    .map(([id]) => id);

  const popularIds = Object.entries(usage)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([id]) => id);

  return { usage, recordVisit, recentIds, popularIds };
}
