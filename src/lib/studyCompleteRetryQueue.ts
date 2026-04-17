/**
 * studyCompleteRetryQueue — minimal local retry queue for study-complete
 * and orchestrator-record-outcome calls.
 *
 * Goal: never lose a pedagogical signal because of a transient network error.
 * Stored in localStorage so it survives reloads. The queue is drained on
 * demand by `flushStudyCompleteQueue` (called on app mount and after every
 * successful invoke).
 */
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "enazizi.studyCompleteRetryQueue.v1";
const MAX_QUEUE = 50;
const MAX_ATTEMPTS = 5;

export interface QueuedStudyComplete {
  id: string;
  enqueuedAt: string;
  attempts: number;
  body: Record<string, unknown>;
}

function read(): QueuedStudyComplete[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedStudyComplete[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, MAX_QUEUE)));
  } catch {
    /* storage full — drop */
  }
}

export function enqueueStudyComplete(body: Record<string, unknown>) {
  const items = read();
  items.push({
    id: crypto.randomUUID(),
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    body,
  });
  write(items);
  console.warn("[studyCompleteRetryQueue] enqueued (size:", items.length, ")");
}

/**
 * Try invoking study-complete. On failure, enqueue for retry.
 * Returns true if the call succeeded immediately.
 */
export async function invokeStudyCompleteWithRetry(
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("study-complete", { body });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("[studyCompleteRetryQueue] invoke failed, enqueuing:", e);
    enqueueStudyComplete(body);
    return false;
  }
}

/**
 * Drain the queue. Called on app mount. Removes items that succeed or
 * exceed MAX_ATTEMPTS.
 */
export async function flushStudyCompleteQueue(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const items = read();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const survivors: QueuedStudyComplete[] = [];
  let flushed = 0;

  for (const item of items) {
    item.attempts += 1;
    try {
      const { error } = await supabase.functions.invoke("study-complete", { body: item.body });
      if (error) throw error;
      flushed += 1;
    } catch (e) {
      console.warn(
        `[studyCompleteRetryQueue] retry ${item.attempts}/${MAX_ATTEMPTS} failed:`,
        e
      );
      if (item.attempts < MAX_ATTEMPTS) survivors.push(item);
    }
  }

  write(survivors);
  return { flushed, remaining: survivors.length };
}
