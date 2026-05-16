// upgrade-questions - ISOLAMENTO PROGRESSIVO FASE 1: HANDLER MÍNIMO
console.log("[upgrade-questions] BOOT: Initing minimal file");

Deno.serve(async (req) => {
  console.log("[upgrade-questions] REQUEST: Received", { 
    method: req.method,
    url: req.url 
  });

  return new Response(JSON.stringify({
    ok: true,
    function: "upgrade-questions",
    boot: "minimal-handler-ok",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    }
  });
});
