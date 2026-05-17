import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { getGoogleAccessToken, processSingleDriveFile } from "../_shared/google-drive.ts";

export default enterpriseEdgeHandler("drive-exam-ingestion", async ({ req, logger, supabaseAdmin, waitUntil, correlation }) => {
  // 1. Auth & Admin Check
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  const body = await req.json().catch(() => ({}));
  const FOLDER_ID = body.folder_id || "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
  
  // ACTION: PROCESS SINGLE FILE
  if (body.action === "process" && body.fileId) {
    logger.info("ACTION_PROCESS", `Processing specific file: ${body.fileId}`);
    
    const runProcessing = async () => {
      try {
        await processSingleDriveFile(body.fileId, { supabaseAdmin, logger, user });
      } catch (err) {
        logger.error("PROCESS_FAIL", `Error processing file ${body.fileId}: ${err.message}`);
      }
    };

    if (body.background !== false) {
      waitUntil(runProcessing());
      return new Response(JSON.stringify({ 
        status: "processing", 
        message: "File processing started in background",
        file_id: body.fileId,
        correlation_id: correlation.correlationId 
      }), { headers: { "Content-Type": "application/json" } });
    } else {
      const result = await processSingleDriveFile(body.fileId, { supabaseAdmin, logger, user });
      return new Response(JSON.stringify({ ...result, correlation_id: correlation.correlationId }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DEFAULT ACTION: LIST AND REGISTER PENDING
  const listAndRegister = async () => {
    try {
      const GOOGLE_SA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
      if (!GOOGLE_SA_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
      const serviceAccount = JSON.parse(GOOGLE_SA_JSON);

      // 1. Google Drive Auth
      const accessToken = await getGoogleAccessToken(serviceAccount, logger);

      // 2. List PDFs in folder
      logger.info("DRIVE_LIST", `Listing PDFs in folder ${FOLDER_ID}...`);
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)`;
      const listResp = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!listResp.ok) {
        throw new Error(`Google Drive API error: ${listResp.status} ${await listResp.text()}`);
      }

      const listData = await listResp.json();
      const files = listData.files || [];
      logger.info("DRIVE_LIST_RESULT", `Found ${files.length} PDFs`);

      // 3. Register new files as "pending"
      let registeredCount = 0;
      for (const file of files) {
        // Check if already in log
        const { data: existing } = await supabaseAdmin
          .from("drive_ingestion_log")
          .select("id")
          .eq("file_id", file.id)
          .maybeSingle();

        if (!existing) {
          await supabaseAdmin.from("drive_ingestion_log").insert({
            file_id: file.id,
            file_name: file.name,
            file_size: file.size ? parseInt(file.size) : null,
            status: 'pending',
            processed_by: user.id
          });
          registeredCount++;
        }
      }

      logger.info("REGISTRATION_DONE", `Registered ${registeredCount} new pending files`);
      return { status: "success", registered: registeredCount, total_found: files.length };

    } catch (err) {
      logger.error("LIST_ERROR", `Failed to list/register: ${err.message}`);
      throw err;
    }
  };

  if (body.background !== false) {
    waitUntil(listAndRegister());
    return new Response(JSON.stringify({ 
      status: "listing", 
      message: "Drive listing started in background",
      correlation_id: correlation.correlationId 
    }), { headers: { "Content-Type": "application/json" } });
  } else {
    const result = await listAndRegister();
    return new Response(JSON.stringify({ ...result, correlation_id: correlation.correlationId }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
