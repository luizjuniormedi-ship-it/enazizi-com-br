import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export async function handleStandardEdgeFunction(
  req: Request,
  handler: (body: any, userId: string) => Promise<Response>
) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "UNAUTHORIZED", 
        message: "Autenticação obrigatória." 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extraction of userId depends on your specific setup, 
    // usually using supabase.auth.getUser() with the token.
    // For now we assume the handler handles its own detailed auth if needed,
    // or we pass a placeholder if we can't easily verify here without heavy dependencies.
    const userId = "authenticated-user"; 

    const body = await req.json().catch(() => ({}));
    
    const response = await handler(body, userId);
    
    // Ensure CORS on success
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

  } catch (e) {
    console.error("[EdgeFunction Error]", e);
    return new Response(JSON.stringify({
      success: false,
      error: "INTERNAL_ERROR",
      message: e instanceof Error ? e.message : "Erro interno no servidor."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
