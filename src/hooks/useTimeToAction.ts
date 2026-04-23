/**
 * Sprint 4 — useTimeToAction
 *
 * - Marca início da sessão-aba quando o usuário está autenticado.
 * - Conta mudanças de rota antes da primeira ação.
 * - Conta cliques globais antes da primeira ação (passive listener, throttled-by-flag).
 *
 * Zero alteração visual. Zero arquitetura. Falhas silenciosas.
 * Montar uma única vez (já feito em DashboardLayout via componente raiz).
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  markSessionStart,
  incrementPreActionClicks,
  incrementPreActionRouteChanges,
  trackBehavioralEvent,
} from "@/lib/behavioralTelemetry";

const FIRST_ACTION_FIRED_KEY = "enazizi_first_action_fired";

export function useTimeToAction() {
  const { user } = useAuth();
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);
  const sessionStartedRef = useRef(false);

  // Marcar início da sessão e disparar evento "session_start"
  useEffect(() => {
    if (!user) return;
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    markSessionStart();
    trackBehavioralEvent({
      userId: user.id,
      eventType: "session_start",
      route: location.pathname,
      metadata: { viewport_width: typeof window !== "undefined" ? window.innerWidth : null },
    });
  }, [user, location.pathname]);

  // Contador de mudanças de rota antes da primeira ação
  useEffect(() => {
    if (!user) return;
    if (lastPathRef.current && lastPathRef.current !== location.pathname) {
      incrementPreActionRouteChanges();
    }
    lastPathRef.current = location.pathname;
  }, [user, location.pathname]);

  // Contador passivo de cliques globais (apenas até a primeira ação)
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    const handler = () => {
      // Para de contar quando a flag de first_action já existe
      try {
        if (sessionStorage.getItem(FIRST_ACTION_FIRED_KEY)) return;
        incrementPreActionClicks();
      } catch {
        /* noop */
      }
    };

    window.addEventListener("click", handler, { passive: true, capture: true });
    return () => {
      window.removeEventListener("click", handler, { capture: true });
    };
  }, [user]);
}
