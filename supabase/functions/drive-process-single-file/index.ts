import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { processSingleDriveFile } from "../_shared/google-drive.ts";

export default enterpriseEdgeHandler("drive-process-single-file", async ({ req, logger, supabaseAdmin, waitUntil, correlation }) => {
  // 1. Auth & Admin Check
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  const body = await req.json().catch(() => ({}));
  const fileId = body.fileId;

  if (!fileId) {
    return new Response(JSON.stringify({ error: "Missing fileId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const runProcessing = async () => {
    try {
      await processSingleDriveFile(fileId, { supabaseAdmin, logger, user });
    } catch (err) {
      logger.error("PROCESS_FAIL", `Error processing file ${fileId}: ${err.message}`);
    }
  };

  if (body.background !== false) {
    waitUntil(runProcessing());
    return new Response(JSON.stringify({ 
      status: "processing", 
      message: "File processing started in background",
      file_id: fileId,
      correlation_id: correlation.correlationId 
    }), { headers: { "Content-Type": "application/json" } });
  } else {
    const result = await processSingleDriveFile(fileId, { supabaseAdmin, logger, user });
    return new Response(JSON.stringify({ ...result, correlation_id: correlation.correlationId }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
