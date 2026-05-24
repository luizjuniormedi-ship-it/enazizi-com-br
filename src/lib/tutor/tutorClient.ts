import { supabase } from "@/integrations/supabase/client";

/**
 * ENAZIZI TUTOR V3 OFFICIAL CLIENT
 * Centralizes all Edge Function calls for Tutor IA with maximum resilience.
 */
export async function callTutorV3(payload: any, options: { 
  functionName?: string, 
  stream?: boolean,
  signal?: AbortSignal 
} = {}) {
  const functionName = options.functionName || "tutor-v3-premium";
  const requestId = payload.requestId || crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  
  // 1. Logs Forenses (Requirements)
  console.log(`[TUTOR_V3_OFFICIAL_CLIENT_CALL] id=${requestId} func=${functionName}`);
  
  try {
    // 2. Auth Session Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("UNAUTHORIZED: No active session found.");
    }

    // 3. Payload Hardening (Serialization Check)
    const safePayload = JSON.parse(JSON.stringify({
      ...payload,
      requestId,
      correlationId,
      stream: options.stream ?? false
    }));

    // 4. Endpoint Construction
    const baseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("VITE_SUPABASE_URL is not configured.");
    
    const url = `${baseUrl}/functions/v1/${functionName}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "x-correlation-id": correlationId,
    };

    console.log(`[TUTOR_V3_INVOKE_START] ${url}`, { correlationId });

    // 5. Native Fetch Execution
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(safePayload),
      signal: options.signal,
      mode: 'cors',
      credentials: 'omit'
    }).catch(err => {
      console.error(`[TUTOR_V3_FETCH_FATAL]`, err);
      // Ensure we provide a clear error message that differentiates from Supabase SDK
      throw new Error(`CONNECTION_ERROR: Failed to reach Tutor Edge Function (${err.message})`);
    });

    console.log(`[TUTOR_V3_INVOKE_STATUS] status=${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `HTTP_ERROR_${response.status}`);
    }

    return response;
  } catch (err: any) {
    console.error(`[TUTOR_V3_INVOKE_ERROR]`, err);
    throw err;
  }
}
