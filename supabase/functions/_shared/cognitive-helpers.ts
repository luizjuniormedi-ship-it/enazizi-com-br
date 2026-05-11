
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

export interface CognitiveProfile {
  fatigue: number; // 0-1
  overload: number; // 0-1
  retention: number; // 0-1
  engagement: number; // 0-1
  abandonmentRisk: number; // 0-1
}

/**
 * Detects fatigue based on session duration, error rate trend, and speed.
 */
export async function detectFatigue(supabase: any, userId: string): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();

  // 1. Session duration (proxy: last few attempts within today)
  const { data: recentAttempts } = await supabase
    .from("practice_attempts")
    .select("created_at, correct")
    .eq("user_id", userId)
    .gte("created_at", todayStart)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!recentAttempts || recentAttempts.length < 10) return 0.1;

  // 2. Error rate trend (last 10 vs previous 10)
  const last10 = recentAttempts.slice(0, 10);
  const prev10 = recentAttempts.slice(10, 20);
  
  const last10Error = last10.filter((a: any) => !a.correct).length / 10;
  const prev10Error = prev10.length > 0 ? prev10.filter((a: any) => !a.correct).length / prev10.length : last10Error;

  let fatigue = 0.2;
  
  if (last10Error > prev10Error + 0.2) {
    fatigue += 0.4; // Performance drop indicates fatigue
  }

  // 3. Density (attempts per hour)
  const firstToday = new Date(recentAttempts[recentAttempts.length - 1].created_at);
  const hoursElapsed = (new Date().getTime() - firstToday.getTime()) / (1000 * 60 * 60);
  const density = recentAttempts.length / Math.max(hoursElapsed, 0.5);

  if (density > 30) fatigue += 0.3; // High intensity

  return Math.min(fatigue, 1.0);
}

/**
 * Calculates current retention score using FSRS data
 */
export async function calculateRetention(supabase: any, userId: string): Promise<number> {
  const { data: cards } = await supabase
    .from("fsrs_cards")
    .select("stability, retrievability")
    .eq("user_id", userId);

  if (!cards || cards.length === 0) return 0.5;

  const avgRetrievability = cards.reduce((acc: number, c: any) => acc + (c.retrievability || 0.9), 0) / cards.length;
  return avgRetrievability;
}
