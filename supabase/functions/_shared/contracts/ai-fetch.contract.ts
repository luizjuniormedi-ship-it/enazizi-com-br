/**
 * ENAZIZI Edge Function Contract — AI Fetch v1
 *
 * Re-export estável dos símbolos públicos de ai-fetch.
 * Edge Functions DEVEM importar daqui.
 */

export const CONTRACT_VERSION = "v1";

export { aiFetch, getAiErrorMessage } from "../ai-fetch.ts";
