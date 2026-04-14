import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
import { isUrlSuspicious, extractCleanImageUrls, validateImageVision } from "../_shared/vision-gate.ts";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCE_MAP: Record<string, { urls: string[]; license: string }> = {
  dermatology: {
    urls: [
      "https://dermnetnz.org/topics/{query}",
      "https://www.dermnet.com/images/{query}",
    ],
    license: "cc_by_nc_nd",
  },
  xray: {
    urls: [
      "https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}&scope=cases",
    ],
    license: "cc_by_nc_sa",
  },
  ct: {
    urls: [
      "https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}&scope=cases",
    ],
    license: "cc_by_nc_sa",
  },
  pathology: {
    urls: [
      "https://www.pathologyoutlines.com/search?searchterm={query}",
    ],
    license: "educational_fair_use",
  },
  ophthalmology: {
    urls: [
      "https://eyewiki.aao.org/w/index.php?search={query}",
    ],
    license: "cc_by_nc_nd",
  },
  us: {
    urls: [
      "https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}+ultrasound&scope=cases",
    ],
    license: "cc_by_nc_sa",
  },
  ecg: {
    urls: [
      "https://litfl.com/ecg-library/{query}/",
      "https://en.ecgpedia.org/wiki/{query}",
      "https://www.wikidoc.org/index.php/{query}_ECG",
    ],
    license: "cc_by_nc_sa",
  },
};

function buildSearchUrl(template: string, query: string): string {
  const slug = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return template.replace("{query}", encodeURIComponent(slug));
}

function extractImageUrls(html: string): string[] {
  return extractCleanImageUrls(html);
}

async function scrapeForImages(url: string): Promise<{ images: string[]; sourceUrl: string }> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not configured");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["html", "links"],
      onlyMainContent: true,
      waitFor: 3000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Firecrawl error for ${url}:`, errText);
    return { images: [], sourceUrl: url };
  }

  const data = await response.json();
  const html = data?.data?.html || data?.html || "";
  const images = extractImageUrls(html);

  return { images, sourceUrl: url };
}

async function downloadAndUpload(
  imageUrl: string,
  imageType: string,
  assetCode: string
): Promise<string | null> {
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;

    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const buffer = new Uint8Array(await imgResp.arrayBuffer());

    if (buffer.length < 5000) return null; // skip tiny images

    const ext = contentType.includes("png") ? "png" : "jpg";
    const safeCode = assetCode
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_");
    const filePath = `${imageType}/${safeCode}_real.${ext}`;

    const { error } = await supabase.storage
      .from("question-images")
      .upload(filePath, buffer, { contentType, upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("question-images")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Download/upload error:", err);
    return null;
  }
}

interface SearchRequest {
  asset_id?: string;
  image_type: string;
  diagnosis: string;
  asset_code?: string;
  batch_mode?: boolean;
  batch_size?: number;
  reprocess_all?: boolean;
  offset?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "O conector Firecrawl não está configurado. Configure a chave FIRECRAWL_API_KEY para habilitar a busca de imagens reais.",
          results: [],
          has_more: false 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SearchRequest = await req.json();

    // Batch mode: search for multiple assets of a given type
    if (body.batch_mode) {
      const { image_type, batch_size = 3, reprocess_all = false, offset = 0 } = body;

      let query = supabase
        .from("medical_image_assets")
        .select("id, asset_code, diagnosis, image_type")
        .eq("image_type", image_type)
        .or("license_type.eq.ai_generated,license_type.is.null,license_type.eq.pending,asset_origin.eq.pending_real")
        .order("diagnosis")
        .range(offset, offset + Math.min(batch_size, 10) - 1);

      if (!reprocess_all) {
        query = query.neq("asset_origin", "real_clinical");
      }

      const { data: assets, error: fetchErr } = await query;

      if (fetchErr || !assets || assets.length === 0) {
        return new Response(
          JSON.stringify({ message: "Nenhum asset elegível encontrado", results: [], has_more: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      for (const asset of assets) {
        const result = await processAsset(asset.id, asset.image_type, asset.diagnosis, asset.asset_code);
        results.push({ asset_id: asset.id, diagnosis: asset.diagnosis, ...result });
        await new Promise((r) => setTimeout(r, 1500));
      }

      const found = results.filter(r => r.status === "found").length;
      const has_more = assets.length === Math.min(batch_size, 10);
      return new Response(JSON.stringify({ results, total: results.length, found, has_more, next_offset: offset + assets.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single asset mode
    const { asset_id, image_type, diagnosis, asset_code } = body;
    if (!image_type || !diagnosis) {
      return new Response(
        JSON.stringify({ error: "image_type e diagnosis são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await processAsset(asset_id || null, image_type, diagnosis, asset_code || diagnosis);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processAsset(
  assetId: string | null,
  imageType: string,
  diagnosis: string,
  assetCode: string
): Promise<{ status: string; image_url?: string; source_url?: string; source_domain?: string }> {
  const sources = SOURCE_MAP[imageType] || SOURCE_MAP["xray"];
  let bestImageUrl: string | null = null;
  let bestSourceUrl = "";
  let bestSourceDomain = "";

  // Step 1: Try direct scrape from known sources
  for (const urlTemplate of sources.urls) {
    const searchUrl = buildSearchUrl(urlTemplate, diagnosis);
    console.log(`Searching: ${searchUrl}`);

    try {
      const { images, sourceUrl } = await scrapeForImages(searchUrl);
      if (images.length > 0) {
        for (const imgUrl of images.slice(0, 5)) {
          const uploaded = await downloadAndUpload(imgUrl, imageType, assetCode);
          if (uploaded) {
            const vision = await validateImageVision(uploaded, diagnosis, imageType, LOVABLE_API_KEY);
            if (!vision.valid) {
              console.warn(`[Vision REJECTED] ${imgUrl}: ${vision.reason}`);
              continue;
            }
            bestImageUrl = uploaded;
            bestSourceUrl = sourceUrl;
            try {
              bestSourceDomain = new URL(sourceUrl).hostname;
            } catch { bestSourceDomain = sourceUrl; }
            break;
          }
        }
        if (bestImageUrl) break;
      }
    } catch (err) {
      console.error(`Error scraping ${urlTemplate}:`, err);
    }
  }

  // Step 2: Fallback — use Firecrawl Search API to find real clinical images on the web
  if (!bestImageUrl && FIRECRAWL_API_KEY) {
    const modalityTerms: Record<string, string> = {
      ecg: "ECG electrocardiogram tracing",
      xray: "X-ray radiograph",
      ct: "CT scan computed tomography",
      us: "ultrasound sonography",
      dermatology: "dermatology clinical photo",
      pathology: "histopathology microscopy",
      ophthalmology: "ophthalmology fundoscopy",
    };

    const searchQuery = `${diagnosis} ${modalityTerms[imageType] || imageType} real clinical image site:radiopaedia.org OR site:wikidoc.org OR site:litfl.com OR site:dermnetnz.org OR site:pathologyoutlines.com`;
    console.log(`Firecrawl search fallback: ${searchQuery}`);

    try {
      const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 3,
          scrapeOptions: { formats: ["html"] },
        }),
      });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const results = searchData?.data || [];

        for (const result of results) {
          const html = result?.html || "";
          const images = extractImageUrls(html);

          for (const imgUrl of images.slice(0, 3)) {
            const uploaded = await downloadAndUpload(imgUrl, imageType, assetCode);
            if (uploaded) {
              const vision = await validateImageVision(uploaded, diagnosis, imageType, LOVABLE_API_KEY);
              if (!vision.valid) {
                console.warn(`[Vision REJECTED] ${imgUrl}: ${vision.reason}`);
                continue;
              }
              bestImageUrl = uploaded;
              bestSourceUrl = result?.url || "";
              try {
                bestSourceDomain = new URL(bestSourceUrl).hostname;
              } catch { bestSourceDomain = "web_search"; }
              break;
            }
          }
          if (bestImageUrl) break;
        }
      }
    } catch (err) {
      console.error("Firecrawl search fallback error:", err);
    }
  }

  if (!bestImageUrl) {
    return { status: "not_found" };
  }

  // Update asset if we have an asset_id
  if (assetId) {
    const { error: updateErr } = await supabase
      .from("medical_image_assets")
      .update({
        image_url: bestImageUrl,
        thumbnail_url: bestImageUrl,
        asset_origin: "real_clinical",
        source_url: bestSourceUrl,
        license_type: sources.license,
        source_domain: bestSourceDomain,
        review_status: "needs_review",
        integrity_status: "pending",
        clinical_confidence: 0.85,
        clinical_validation_notes: `Imagem real encontrada em ${bestSourceDomain} em ${new Date().toISOString()}. Requer validação visual.`,
      })
      .eq("id", assetId);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return { status: "upload_ok_update_failed", image_url: bestImageUrl };
    }
  }

  return {
    status: "found",
    image_url: bestImageUrl,
    source_url: bestSourceUrl,
    source_domain: bestSourceDomain,
  };
}
