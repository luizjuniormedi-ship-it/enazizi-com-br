import { supabase } from "@/integrations/supabase/client";
import { cognitiveSnapshotEngine } from "./cognitive-snapshot-engine";

/**
 * PHASE 4: Event Replay Runtime
 * Reconstructs cognitive history by reapplying versioned events.
 */

export class EventReplayEngine {
  private static instance: EventReplayEngine;

  private constructor() {}

  public static getInstance(): EventReplayEngine {
    if (!EventReplayEngine.instance) {
      EventReplayEngine.instance = new EventReplayEngine();
    }
    return EventReplayEngine.instance;
  }

  /**
   * Reconstrói o estado cognitivo a partir de um ponto no tempo.
   */
  async replayFrom(userId: string, startTime: string) {
    console.log(`[COG_REPLAY] Starting replay for ${userId} from ${startTime}`);

    // 1. Find nearest snapshot before startTime
    const { data: lastSnapshot } = await supabase
      .from('cognitive_snapshots')
      .select('*')
      .eq('user_id', userId)
      .lt('timestamp', startTime)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSnapshot) {
      await cognitiveSnapshotEngine.rollback(lastSnapshot.id);
    }

    // 2. Fetch all events after snapshot/startTime in strict order
    const { data: events, error } = await supabase
      .from('pedagogical_events')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', lastSnapshot?.timestamp || startTime)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log(`[COG_REPLAY] Reapplying ${events?.length || 0} events...`);

    // 3. Sequential Re-propagation
    for (const event of events || []) {
      await this.reapplyEvent(event);
    }

    return { success: true, replayed_count: events?.length || 0 };
  }

  private async reapplyEvent(event: any) {
    console.log(`[COG_REPLAY] Reapplying: ${event.event_type}`);
    // Trigger consumer directly or via Edge Function with replay flag
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pedagogical-event-consumer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({ 
        event: { ...event, metadata: { ...event.metadata, is_replay: true } } 
      })
    });
  }
}

export const eventReplayEngine = EventReplayEngine.getInstance();
