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
    console.log("ENV check:", { 
      hasClientEmail: !!Deno.env.get("GOOGLE_SA_CLIENT_EMAIL"),
      hasTokenUri: !!Deno.env.get("GOOGLE_SA_TOKEN_URI"),
      hasPkPart1: !!Deno.env.get("GOOGLE_SA_PK_PART1"),
      hasPkPart2: !!Deno.env.get("GOOGLE_SA_PK_PART2"),
    });

    const client_email = Deno.env.get("GOOGLE_SA_CLIENT_EMAIL");
    const token_uri = Deno.env.get("GOOGLE_SA_TOKEN_URI") || "https://oauth2.googleapis.com/token";
    const pkPart1 = Deno.env.get("GOOGLE_SA_PK_PART1") || "";
    const pkPart2 = Deno.env.get("GOOGLE_SA_PK_PART2") || "";

    if (!client_email || !pkPart1 || !pkPart2) {
      results.error = "MISSING_GOOGLE_SA_SECRETS";
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    const pemBody = pkPart1 + pkPart2;
    results.private_key_id = "individual_pk_parts";
    
    results.step = "jwt_generation";
    const now = Math.floor(Date.now() / 1000);

    console.log(`Auth test PK body prefix: ${pemBody.substring(0, 30)}`);

    // 3. Decode base64
    const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    // 4. Import Key using Native Crypto (matching shared logic)
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // 5. Generate JWT components
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (obj: any) => {
      const str = JSON.stringify(obj);
      return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // 6. Sign
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const jwt = `${unsignedToken}.${encodedSignature}`;

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
