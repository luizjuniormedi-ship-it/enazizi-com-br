import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const results: any = {
    ok: false,
    auth_success: false,
    files_count: 0,
    private_key_id: "",
    error: null,
    step: "init"
  };

  try {
    let googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
    if (!googleJson) {
      results.error = "SECRET_NOT_FOUND";
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Sanitize JSON string: remove wrapping quotes and handle unescaped characters
    googleJson = googleJson.trim();
    if (googleJson.startsWith('"') && googleJson.endsWith('"')) {
      googleJson = googleJson.slice(1, -1);
    }
    // Handle unescaped internal quotes and newlines if it was stored as a string literal
    googleJson = googleJson.replace(/\\n/g, '\n').replace(/\\"/g, '"');

    const credentials = JSON.parse(googleJson);
    results.private_key_id = credentials.private_key_id?.substring(0, 8) || "not_found";
    
    results.step = "jwt_generation";
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose.SignJWT({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
      .setProtectedHeader({ alg: "RS256", kid: credentials.private_key_id })
      .sign(await jose.importPKCS8(credentials.private_key, "RS256"));

    results.step = "token_exchange";
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      results.error = `Auth failed: ${errorText}`;
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }

    const { access_token } = await tokenResponse.json();
    results.auth_success = true;

    results.step = "listing_files";
    const folderId = "1sR5ArIv6MWc-1QR4zhfRKNG07queUya-";
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,size)`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      results.error = `Drive list failed: ${errorText}`;
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    const data = await driveResponse.json();
    results.files_count = data.files?.length || 0;
    results.ok = true;
    results.step = "completed";

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    results.error = err.message;
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})
