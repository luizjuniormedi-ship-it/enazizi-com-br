import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "proficiency-pilot-checklist-v1";

export interface ChecklistItem {
  text: string;
  done: boolean;
  observation: string;
}

const DEFAULT_ITEMS: Omit<ChecklistItem, "done" | "observation">[] = [
  { text: "Criar plano individual" },
  { text: "Criar plano por turma" },
  { text: "Validar geração automática de tarefas" },
  { text: "Concluir 1 tarefa (status atualiza)" },
  { text: "Pular 1 tarefa (status atualiza)" },
  { text: "Simular atraso (missed_goal dispara)" },
  { text: "Validar BI (avgProgress, lateCount, inactiveCount)" },
  { text: "Aluno inativo aparece marcado" },
  { text: "Exportar CSV (turma + inativo corretos)" },
  { text: "Aluno sem plano vê fallback antigo" },
];

function loadInitial(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChecklistItem[];
      if (Array.isArray(parsed) && parsed.length === DEFAULT_ITEMS.length) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_ITEMS.map((i) => ({ ...i, done: false, observation: "" }));
}

export function usePilotChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  const toggle = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, done: !it.done } : it)),
    );
  }, []);

  const updateObs = useCallback((index: number, observation: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, observation } : it)),
    );
  }, []);

  const reset = useCallback(() => {
    setItems(DEFAULT_ITEMS.map((i) => ({ ...i, done: false, observation: "" })));
  }, []);

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? doneCount / items.length : 0;

  return { items, toggle, updateObs, reset, progress, doneCount };
}
