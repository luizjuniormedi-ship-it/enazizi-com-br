/**
 * FocusModeEntry
 * ──────────────
 * Toggle leve para entrar/sair do "Modo Foco" do GuidedFlowLayer.
 *
 * Modo Foco:
 *  - Esconde ruído visual no Dashboard (cockpit, panels secundários, módulos)
 *  - Mantém apenas: orientação guiada (StartHere, NBA, Missão, Revisão, Foco)
 *  - Botão sempre visível para "Voltar ao Dashboard completo"
 *
 * Persistência: localStorage (`enazizi.focus_mode` = "1" | "0").
 * Sem rota nova, sem schema novo.
 */
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Focus, LayoutDashboard } from "lucide-react";

const STORAGE_KEY = "enazizi.focus_mode";
const EVENT = "enazizi:focus-mode-change";

export function getFocusMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setFocusMode(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** Hook para componentes que precisam reagir ao Modo Foco. */
export function useFocusMode(): [boolean, (v: boolean) => void] {
  const [mode, setMode] = useState<boolean>(() => getFocusMode());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setMode(!!detail);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const update = useCallback((v: boolean) => setFocusMode(v), []);
  return [mode, update];
}

export default function FocusModeEntry() {
  const [mode, update] = useFocusMode();

  return (
    <div className="flex items-center justify-end">
      <Button
        size="sm"
        variant={mode ? "default" : "ghost"}
        className="text-xs"
        onClick={() => update(!mode)}
        aria-pressed={mode}
      >
        {mode ? (
          <>
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            Voltar ao Dashboard completo
          </>
        ) : (
          <>
            <Focus className="mr-1.5 h-3.5 w-3.5" />
            Modo Foco
          </>
        )}
      </Button>
    </div>
  );
}
