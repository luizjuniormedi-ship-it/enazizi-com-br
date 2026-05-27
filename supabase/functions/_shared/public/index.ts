/**
 * ENAZIZI Edge Function — Public Barrel v1
 *
 * Re-exports oficiais. Importe daqui em vez de tocar internos.
 */

export const CONTRACT_VERSION = "v1";

export {
  cleanQuestionText,
  parseAiJson,
} from "../contracts/parser.contract.ts";
export { aiFetch, getAiErrorMessage } from "../contracts/ai-fetch.contract.ts";
export {
  EDGE_LOG,
  logEdge,
  safeFallbackResponse,
} from "../contracts/telemetry.contract.ts";
