import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const SA_EMAIL = "enazizi-drive-reader@enazizi.iam.gserviceaccount.com";
const SA_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SA_PRIVATE_KEY_B64 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDeQwllT5BbX4pbtblw7u+xTtw2J5wv1erns7TNKWbR1sMFp6bwqAzSESz4JRky7ODbmT/0CTiyou/wQ/1FvI5q/6UAnOtSziiuFy2v2dE2CeipH0SqU4ENDy251+ap4q8v59rbAhPcaPVeXqOPA5zd+w6Ldn/0JKhT1Wh3YdaZQhaeT7ZCCBTGtatxGSfaQGjA85VZHwrc5uHpKoaFO+7XAE9hsNq/iRlbC89eUIkE1GG9NHKvYYVR0QP1MO9kF6jAwjAo3d4LkkYxojBukVustkElNzG614SDDt/+igroNkLXrHMjoYze+55AzuMA3HOWZA8dMz7sT1tnbtYiovZjAgMBAAECggEAF9b964F4vOxHBWY9EUl3qT+JrD9cZ98clqS2aGkf77MG8RTV+as00NVpyuYDyWwSBEvwSacxjyud69oHERNT/VMVajbqoNOfFmlDC8EjyRWQAI/riA9z4Kg3od7wDVnUq6FFXsdexP33D5u8FGtxSHgUy822lMPX0EIsNd3nLEHwvNHGVxDFoyeE431S7AE53SS2uwoEb54WKuOw0wubAHf4avc6ZwwJ3n7trKMPQudU1UyihJ2mQqJZTnB2Sxxk72DxrWHUQ20z17QjJ4qZRm5+3orrG/xh0E2hUCS2dhhnu5VsMHd6UHEVo0zV51n4mjjXdAWKTvde6dknQM1qlQKBgQD5l6JUi3aUhVAu43Z2o1D+koVCkxTZwg/rJepeMr2MVdcX5xe4gYFORVHXnA4rc6GZF+li5iwwGy4YMJg9lC95asXzy7ixDGPquCtxsHBgPJOCgisa+w+cdWrDLXhr5iwEAI/MIF5j+fs4q4FcMJrxk2Ic3cOqaAeTwazUZ7FIdQKBgQDj98gpShNAMu7MgjFKOxmEyhi+6FF7GekET6D3g3p3177mDPmOGi3aZbnQ4VoFzR7ovkuYrANj4SjU+mBBqQ91wh1WcgfaoNd0S/XZUj/oX0Osey1jNk2tSUJheQcJs4vFrZumanb45gsL0TFw4hGes7pOR+vmJbbzNq4/D0godwKBgBdUkznv51+urnYTkQk57uI88/PrJ7HLMA2895FikNFDXN3BHjiC8oFMfX/3+GMbZemXkJtMBKligQaF1FU9OsrQrjxBuLvj+psAKB9ybK6yOt+iJ0FYYncvipE/+NetJkQhgU+FXw1dWpxLe8YQTQtzyWIFYLrXCo5HNk6MesfZAoGAY8h7VodT8c/Zcq6yAHnp65PCTR3HPIjU08w++tgT7Q0ERBH90dNnqqbINMPO8acdFmblFAiG21sc0kxdgaAMYlD7InF7OpkYdZEiJWO5EW9RYdfwv/JvAaCFa8Db8cUjMv2QmcEUHlIjF6MTbwOlDsBAli8o9G4hrEeM8ZEw1nUCgYEA95ll1mt9GO9uVv9Tz1EneaMDqK8s4r20GskXu5HJL9Peh78HemLHMofX8r9OQFM6fQXbEdNr12O5DOV0mX/ef/jNLmqCb8+T7vfiVlme0wuZZ91VMBRWRa9cJdMPla8/44A4lBFb9gV9wPJZb/F7VF4p0ORqTNnTRiLbU1cIvbM=";

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
    results.private_key_id = "hardcoded_b64";
    const client_email = SA_EMAIL;
    const pemBody = SA_PRIVATE_KEY_B64;
    
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
