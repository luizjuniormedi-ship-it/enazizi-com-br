import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";

Deno.serve(enterpriseEdgeHandler("framework-test", async ({ logger }: EnterpriseContext) => {
  console.log("HELLO FROM CONSOLE LOG");
  logger.info("TEST", "Hello from framework logger");
  return new Response(JSON.stringify({ ok: true, framework: "active" }), {
    headers: { "Content-Type": "application/json" }
  });
});
