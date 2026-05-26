/**
 * [QUERY_LOOP_GUARD v26]
 * Defensive cache + inflight dedup for public login RPCs.
 * - Module-level singleton (survives component remounts)
 * - 5 min TTL (these are aggregate public stats; staleness is fine)
 * - Inflight promise sharing (concurrent callers receive the same request)
 * Compatible with Operational Governance Freeze v25 — defensive bugfix only.
 */
import { supabase } from "@/integrations/supabase/client";

export interface LoginStats {
  alunos: number;
  questoes: number;
  flashcards: number;
}

export interface LoginTestimonial {
  feedback_text: string;
  avg_rating: number;
  display_name: string;
}

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

let statsCache: CacheEntry<LoginStats> | null = null;
let statsInflight: Promise<LoginStats | null> | null = null;

let testimonialsCache: CacheEntry<LoginTestimonial[]> | null = null;
let testimonialsInflight: Promise<LoginTestimonial[] | null> | null = null;

const fresh = <T>(entry: CacheEntry<T> | null): T | null =>
  entry && Date.now() - entry.ts < TTL_MS ? entry.data : null;

export async function fetchLoginStats(): Promise<LoginStats | null> {
  const cached = fresh(statsCache);
  if (cached) {
    console.log("[QUERY_DEDUPE] get_login_stats cache hit");
    return cached;
  }
  if (statsInflight) {
    console.log("[QUERY_ABORT_DUPLICATE] get_login_stats inflight reuse");
    return statsInflight;
  }
  console.log("[LOGIN_STATS_FETCH]");
  statsInflight = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_login_stats").maybeSingle();
      if (error || !data) return null;
      const normalized: LoginStats = {
        alunos: Number((data as any).alunos) || 0,
        questoes: Number((data as any).questoes) || 0,
        flashcards: Number((data as any).flashcards) || 0,
      };
      statsCache = { data: normalized, ts: Date.now() };
      return normalized;
    } catch {
      return null;
    } finally {
      statsInflight = null;
    }
  })();
  return statsInflight;
}

export async function fetchLoginTestimonials(): Promise<LoginTestimonial[] | null> {
  const cached = fresh(testimonialsCache);
  if (cached) {
    console.log("[QUERY_DEDUPE] get_login_testimonials cache hit");
    return cached;
  }
  if (testimonialsInflight) {
    console.log("[QUERY_ABORT_DUPLICATE] get_login_testimonials inflight reuse");
    return testimonialsInflight;
  }
  console.log("[LOGIN_TESTIMONIALS_FETCH]");
  testimonialsInflight = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_login_testimonials");
      if (error || !Array.isArray(data)) return null;
      const normalized = data as LoginTestimonial[];
      testimonialsCache = { data: normalized, ts: Date.now() };
      return normalized;
    } catch {
      return null;
    } finally {
      testimonialsInflight = null;
    }
  })();
  return testimonialsInflight;
}
