import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
import { isUrlSuspicious, extractCleanImageUrls, validateImageVision } from "../_shared/vision-gate.ts";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== PT→EN DIAGNOSIS MAP =====
const DIAGNOSIS_EN: Record<string, string> = {
  "fibrilação atrial": "atrial fibrillation",
  "flutter atrial": "atrial flutter",
  "infarto agudo do miocárdio com supra de st": "ST elevation myocardial infarction STEMI",
  "bloqueio de ramo esquerdo": "left bundle branch block LBBB",
  "bloqueio de ramo direito": "right bundle branch block RBBB",
  "taquicardia ventricular": "ventricular tachycardia",
  "bav 2º grau mobitz ii": "second degree heart block Mobitz type II",
  "bav total": "complete heart block third degree AV block",
  "síndrome de wolff-parkinson-white": "Wolff-Parkinson-White syndrome WPW",
  "hipercalemia": "hyperkalemia ECG",
  "pneumotórax": "pneumothorax",
  "derrame pleural": "pleural effusion",
  "pneumonia lobar": "lobar pneumonia",
  "edema agudo de pulmão": "pulmonary edema",
  "fratura de clavícula": "clavicle fracture",
  "tuberculose pulmonar": "pulmonary tuberculosis",
  "cardiomegalia": "cardiomegaly",
  "atelectasia": "atelectasis",
  "apendicite aguda": "acute appendicitis",
  "diverticulite aguda": "acute diverticulitis",
  "embolia pulmonar": "pulmonary embolism CT",
  "avc isquêmico agudo": "acute ischemic stroke CT",
  "hemorragia subaracnóidea": "subarachnoid hemorrhage CT",
  "hidrocefalia": "hydrocephalus CT",
  "pancreatite aguda": "acute pancreatitis CT",
  "dissecção de aorta": "aortic dissection CT",
  "trombose venosa profunda": "deep vein thrombosis ultrasound",
  "colecistite aguda": "acute cholecystitis ultrasound",
  "estenose de artéria renal": "renal artery stenosis doppler",
  "apendicite - ultrassom": "appendicitis ultrasound",
  "derrame pericárdico": "pericardial effusion echocardiogram",
  "esteatose hepática": "hepatic steatosis ultrasound fatty liver",
  "psoríase em placas": "plaque psoriasis",
  "dermatite atópica": "atopic dermatitis eczema",
  "melanoma": "melanoma dermoscopy",
  "carcinoma basocelular": "basal cell carcinoma",
  "herpes zóster": "herpes zoster shingles",
  "lúpus eritematoso sistêmico": "systemic lupus erythematosus skin",
  "escabiose": "scabies",
  "urticária": "urticaria hives",
  "vitiligo": "vitiligo",
  "hanseníase": "leprosy Hansen disease",
  "pênfigo vulgar": "pemphigus vulgaris",
  "líquen plano": "lichen planus",
  "eritema multiforme": "erythema multiforme",
  "molusco contagioso": "molluscum contagiosum",
  "impetigo": "impetigo",
  "celulite": "cellulitis",
  "erisipela": "erysipelas",
  "tinea corporis": "tinea corporis ringworm",
  "tinea capitis": "tinea capitis",
  "pitiríase versicolor": "pityriasis versicolor",
  "acne vulgar": "acne vulgaris",
  "rosácea": "rosacea",
  "dermatite seborreica": "seborrheic dermatitis",
  "dermatite de contato": "contact dermatitis",
  "alopecia areata": "alopecia areata",
  "queratose actínica": "actinic keratosis",
  "carcinoma espinocelular": "squamous cell carcinoma skin",
  "sarcoma de kaposi": "Kaposi sarcoma",
  "micose fungóide": "mycosis fungoides",
  "pênfigo foliáceo": "pemphigus foliaceus",
  "dermatite herpetiforme": "dermatitis herpetiformis",
  "eritema nodoso": "erythema nodosum",
  "granuloma anular": "granuloma annulare",
  "xantoma": "xanthoma",
  "necrobiose lipoídica": "necrobiosis lipoidica",
  "sarcoidose cutânea": "cutaneous sarcoidosis",
  "pitiríase rósea": "pityriasis rosea",
  "síndrome de stevens-johnson": "Stevens-Johnson syndrome",
  "necrólise epidérmica tóxica": "toxic epidermal necrolysis",
  "adenocarcinoma gástrico": "gastric adenocarcinoma histopathology",
  "carcinoma ductal invasivo de mama": "invasive ductal carcinoma breast histopathology",
  "linfoma de hodgkin": "Hodgkin lymphoma histopathology Reed-Sternberg",
  "linfoma não-hodgkin difuso de grandes células b": "diffuse large B-cell lymphoma histopathology",
  "adenocarcinoma colorretal": "colorectal adenocarcinoma histopathology",
  "carcinoma de células escamosas de esôfago": "esophageal squamous cell carcinoma histopathology",
  "carcinoma hepatocelular": "hepatocellular carcinoma histopathology",
  "doença celíaca": "celiac disease histopathology",
  "glomerulonefrite membranosa": "membranous glomerulonephritis histopathology",
  "tuberculose ganglionar": "tuberculous lymphadenitis histopathology",
  "carcinoma papilífero de tireoide": "papillary thyroid carcinoma histopathology",
  "doença de crohn": "Crohn disease histopathology",
  "retinite por cmv": "CMV retinitis",
  "retinopatia diabética": "diabetic retinopathy fundoscopy",
  "glaucoma": "glaucoma optic disc cupping",
  "descolamento de retina": "retinal detachment fundus photo",
  "edema macular": "macular edema OCT fundus",
  "oclusão de veia central da retina": "central retinal vein occlusion fundus",
  "neurite óptica": "optic neuritis fundoscopy",
  "melanoma de coroide": "choroidal melanoma",
  "papiledema": "papilledema bilateral optic disc swelling",
  "blefarite": "blepharitis eyelid",
  "catarata matura": "mature cataract slit lamp",
  "ceratite herpética dendrítica": "herpes simplex dendritic keratitis fluorescein",
  "impetigo crostoso": "impetigo crusted skin lesion",
  "apendicite aguda — infiltrado neutrofílico transmural": "acute appendicitis neutrophilic transmural inflammation histopathology",
  "cirrose hepática — fibrose em ponte": "liver cirrhosis bridging fibrosis histopathology trichrome",
  "endometriose — glândulas e estroma endometrial ectópico": "endometriosis ectopic endometrial glands histopathology",
  "infarto do miocárdio — necrose coagulativa": "myocardial infarction coagulative necrosis histopathology",
  "adenocarcinoma de pulmão": "lung adenocarcinoma histopathology",
  "meningioma": "meningioma histopathology",
  "glioblastoma": "glioblastoma histopathology",
  "carcinoma de células renais": "renal cell carcinoma histopathology",
  "litíase renal": "renal calculus kidney stone ultrasound",
  "estenose de piloro": "pyloric stenosis ultrasound",
  "gravidez ectópica": "ectopic pregnancy ultrasound",
  "hidronefrose": "hydronephrosis ultrasound",
  "nódulo tireoidiano": "thyroid nodule ultrasound",
  "retinopatia hipertensiva": "hypertensive retinopathy fundus",
  "oclusão de artéria central da retina": "central retinal artery occlusion cherry red spot",
  "degeneração macular relacionada à idade": "age related macular degeneration AMD fundus",
  "uveíte anterior": "anterior uveitis slit lamp",
  "pterígio": "pterygium eye",
  "pneumotórax hipertensivo": "tension pneumothorax chest CT",
  "aneurisma de aorta abdominal": "abdominal aortic aneurysm CT",
  "pneumomediastino": "pneumomediastinum chest xray",
  "nódulo pulmonar solitário": "solitary pulmonary nodule chest xray",
  "fratura de costela": "rib fracture chest xray",
  "corpo estranho esofágico": "esophageal foreign body xray",
  "bronquiectasias": "bronchiectasis chest xray",
};

function translateDiagnosis(ptDiagnosis: string): string {
  const key = ptDiagnosis.toLowerCase().trim();
  return DIAGNOSIS_EN[key] || ptDiagnosis;
}

// ===== MODALITY TERMS =====
const MODALITY_TERMS: Record<string, string> = {
  ecg: "ECG electrocardiogram",
  xray: "X-ray chest radiograph",
  ct: "CT computed tomography",
  us: "ultrasound sonography",
  dermatology: "dermatology clinical photo skin",
  pathology: "histopathology microscopy",
  ophthalmology: "ophthalmology fundoscopy retina",
};

// ===== SAFETY FILTER =====
function safetyFilter(imageUrl: string): { safe: boolean; reason?: string } {
  const url = imageUrl.toLowerCase();
  const urlCheck = isUrlSuspicious(imageUrl);
  if (urlCheck.suspicious) return { safe: false, reason: urlCheck.reason };
  // Block commercial stock sites
  const blockedSources = ["shutterstock", "gettyimages", "istockphoto", "dreamstime", "pinterest", "instagram", "facebook", "twitter"];
  for (const d of blockedSources) {
    if (url.includes(d)) return { safe: false, reason: `Blocked source: ${d}` };
  }
  // Block non-clinical content patterns
  const blockedPatterns = [
    "screenshot", "chart", "graph", "infographic", "diagram", "flowchart",
    "quality-index", "quality_index", "questionnaire", "survey", "score-card",
    "life-quality", "life_quality", "dlqi", "qol-", "qol_",
    "header-image", "hero-image", "feature-image", "thumbnail-small",
    "widget", "sidebar", "navbar", "footer", "sponsor", "advertisement",
    "social-media", "share-button", "play-button", "video-thumb",
    "certificate", "badge", "award", "trophy",
  ];
  for (const p of blockedPatterns) {
    if (url.includes(p)) return { safe: false, reason: `Non-clinical pattern: ${p}` };
  }
  // Block images that are clearly UI/web elements by dimensions in URL
  if (/[_-](16|24|32|48|64|96|128)x\1/.test(url)) {
    return { safe: false, reason: "Icon-sized image" };
  }
  if (url.includes("patient") && url.includes("photo") && !url.includes("pathology")) {
    return { safe: false, reason: "Potential PHI risk" };
  }
  return { safe: true };
}

// ===== IMAGE EXTRACTION =====
function extractImageUrls(html: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  // Non-clinical keywords in URL or alt text
  const blockedUrlParts = [
    "logo", "icon", "avatar", "banner", "favicon", "tracking",
    "ad-", "pixel", "analytics", "sprite", "placeholder",
    "social", "share", "button", "arrow", "caret", "chevron",
    "loading", "spinner", "skeleton", "gradient", "overlay",
    "watermark", "stamp", "badge", "ribbon", "star-rating",
    "thumb-small", "thumb-tiny", "emoji", "smiley",
    "screenshot", "mockup", "wireframe", "ui-", "ux-",
  ];
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const fullTag = match[0].toLowerCase();
    if (!src.startsWith("http")) continue;
    const srcLower = src.toLowerCase();
    // Check URL blocked parts
    if (blockedUrlParts.some(p => srcLower.includes(p))) continue;
    // Must be a valid image extension or /images/ path
    if (!(srcLower.endsWith(".jpg") || srcLower.endsWith(".jpeg") || srcLower.endsWith(".png") || srcLower.endsWith(".webp") || srcLower.includes("/images/"))) continue;
    // Check alt text for non-clinical markers
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch?.[1]?.toLowerCase() || "";
    if (alt.includes("logo") || alt.includes("icon") || alt.includes("chart") || alt.includes("graph") || alt.includes("screenshot") || alt.includes("infographic")) continue;
    // Prefer images with clinical alt text
    urls.push(src);
  }
  return urls;
}

// ===== AI VISION VALIDATION =====
async function validateImageWithVision(imageUrl: string, expectedDiagnosis: string, imageType: string): Promise<{ valid: boolean; reason: string }> {
  return validateImageVision(imageUrl, expectedDiagnosis, imageType, LOVABLE_API_KEY);
}

// ===== FIRECRAWL SCRAPE =====
async function scrapeWithFirecrawl(url: string): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: true, waitFor: 2000 }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return extractImageUrls(data?.data?.html || data?.html || "");
  } catch { return []; }
}

// ===== FIRECRAWL WEB SEARCH =====
async function webSearchImages(query: string): Promise<{ images: string[]; sourceUrl: string; sourceName: string }> {
  if (!FIRECRAWL_API_KEY) return { images: [], sourceUrl: "", sourceName: "" };
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query + " site:radiopaedia.org OR site:dermnetnz.org OR site:pathologyoutlines.com OR site:litfl.com OR site:eyewiki.aao.org",
        limit: 3,
        scrapeOptions: { formats: ["html"] },
      }),
    });
    if (!resp.ok) return { images: [], sourceUrl: "", sourceName: "" };
    const data = await resp.json();
    for (const r of data?.data || []) {
      const imgs = extractImageUrls(r?.html || "");
      if (imgs.length > 0) {
        let name = "web"; try { name = new URL(r?.url || "").hostname; } catch {}
        return { images: imgs, sourceUrl: r?.url || "", sourceName: name };
      }
    }
  } catch {}
  return { images: [], sourceUrl: "", sourceName: "" };
}

// ===== DOWNLOAD & UPLOAD =====
async function downloadAndUpload(imageUrl: string, imageType: string, assetCode: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(imageUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length < 5000) return null;
    const ext = ct.includes("png") ? "png" : "jpg";
    const safe = assetCode.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
    const path = `${imageType}/${safe}_curated_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(path, buf, { contentType: ct, upsert: true });
    if (error) { console.error("Upload err:", error); return null; }
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
  } catch { return null; }
}

// ===== TRUSTED SOURCES =====
const TRUSTED = ["openi.nlm.nih.gov", "radiopaedia.org", "dermnetnz.org", "litfl.com", "ecgpedia.org", "pathologyoutlines.com", "eyewiki.aao.org", "medpix.nlm.nih.gov"];

// ===== SOURCE URLS =====
const SOURCE_URLS: Record<string, { name: string; url: (q: string) => string; license: string }[]> = {
  ecg: [
    { name: "LITFL", url: (q) => `https://litfl.com/ecg-library/${q.toLowerCase().replace(/\s+/g, "-")}/`, license: "cc_by_nc_sa" },
  ],
  xray: [
    { name: "Radiopaedia", url: (q) => `https://radiopaedia.org/search?q=${encodeURIComponent(q)}&scope=cases`, license: "cc_by_nc_sa" },
  ],
  ct: [
    { name: "Radiopaedia", url: (q) => `https://radiopaedia.org/search?q=${encodeURIComponent(q + " CT")}&scope=cases`, license: "cc_by_nc_sa" },
  ],
  us: [
    { name: "Radiopaedia", url: (q) => `https://radiopaedia.org/search?q=${encodeURIComponent(q + " ultrasound")}&scope=cases`, license: "cc_by_nc_sa" },
  ],
  dermatology: [
    { name: "DermNet NZ", url: (q) => `https://dermnetnz.org/topics/${q.toLowerCase().replace(/\s+/g, "-")}`, license: "cc_by_nc_nd" },
  ],
  pathology: [
    { name: "PathologyOutlines", url: (q) => `https://www.pathologyoutlines.com/search?searchterm=${encodeURIComponent(q)}`, license: "educational_fair_use" },
  ],
  ophthalmology: [
    { name: "EyeWiki", url: (q) => `https://eyewiki.aao.org/w/index.php?search=${encodeURIComponent(q)}`, license: "cc_by_nc_nd" },
    { name: "Radiopaedia", url: (q) => `https://radiopaedia.org/search?q=${encodeURIComponent(q + " eye fundus")}&scope=cases`, license: "cc_by_nc_sa" },
  ],
};

// ===== PROCESS SINGLE ASSET =====
async function processAsset(asset: { id: string; asset_code: string; image_type: string; diagnosis: string }) {
  const { id, asset_code, image_type, diagnosis } = asset;
  const diagnosisEn = translateDiagnosis(diagnosis);
  const modality = MODALITY_TERMS[image_type] || image_type;
  const queries: string[] = [];
  const issues: string[] = [];
  let bestUrl = "";
  let sourceName = "";
  let sourcePageUrl = "";
  let license = "unknown";

  console.log(`[Asset] ${asset_code}: "${diagnosis}" → "${diagnosisEn}" (${image_type})`);

  // STEP 1: Firecrawl web search (fastest, most reliable)
  if (FIRECRAWL_API_KEY) {
    const wsq = `${diagnosisEn} ${modality} real clinical image`;
    queries.push(`[WebSearch] ${wsq}`);
    const ws = await webSearchImages(wsq);
    for (const img of ws.images.slice(0, 5)) {
      const s = safetyFilter(img);
      if (!s.safe) { issues.push(s.reason!); continue; }
      const up = await downloadAndUpload(img, image_type, asset_code);
      if (up) { bestUrl = up; sourceName = ws.sourceName; sourcePageUrl = ws.sourceUrl; license = "cc_by_nc_sa"; break; }
    }
  }

  // STEP 2: Firecrawl scrape trusted sites directly
  if (!bestUrl && FIRECRAWL_API_KEY) {
    const srcList = SOURCE_URLS[image_type] || [];
    for (const src of srcList) {
      const url = src.url(diagnosisEn);
      queries.push(`[${src.name}] ${url}`);
      const imgs = await scrapeWithFirecrawl(url);
      for (const img of imgs.slice(0, 5)) {
        const s = safetyFilter(img);
        if (!s.safe) { issues.push(s.reason!); continue; }
        const up = await downloadAndUpload(img, image_type, asset_code);
        if (up) { bestUrl = up; sourceName = src.name; sourcePageUrl = url; license = src.license; break; }
      }
      if (bestUrl) break;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // STEP 3: AI Vision validation — reject screenshots, charts, non-clinical images
  if (bestUrl) {
    console.log(`[Vision Check] Validating ${bestUrl} for "${diagnosis}" (${image_type})`);
    const visionResult = await validateImageWithVision(bestUrl, diagnosis, image_type);
    if (!visionResult.valid) {
      console.warn(`[Vision REJECTED] ${asset_code}: ${visionResult.reason}`);
      issues.push(`Vision rejected: ${visionResult.reason}`);
      bestUrl = ""; // Clear — this image is not clinical
      sourceName = "";
      sourcePageUrl = "";
    } else {
      console.log(`[Vision OK] ${asset_code}: ${visionResult.reason}`);
    }
  }

  // Classify
  const isTrusted = TRUSTED.some(t => sourceName.includes(t));
  const downloaded = !!bestUrl;
  const validationLevel = downloaded ? (isTrusted ? "silver" : "bronze") : "blocked";
  const coherence = downloaded ? (isTrusted ? 80 : 60) : 0;
  const confidence = downloaded ? (isTrusted ? 75 : 50) : 0;

  // Update DB
  if (downloaded) {
    await supabase.from("medical_image_assets").update({
      image_url: bestUrl,
      thumbnail_url: bestUrl,
      asset_origin: "real_medical",
      review_status: "needs_review",
      integrity_status: "pending",
      clinical_confidence: confidence / 100,
      source_url: sourcePageUrl,
      source_domain: sourceName,
      license_type: license,
      validation_level: validationLevel,
      multimodal_ready: false,
      visual_coherence_score: coherence,
      diagnostic_confidence_score: confidence,
      access_type: "open",
      curation_notes: `Curated from ${sourceName} on ${new Date().toISOString()}. EN: "${diagnosisEn}". Vision-validated. Requires review.`,
    }).eq("id", id);
  } else {
    await supabase.from("medical_image_assets").update({
      validation_level: "blocked",
      multimodal_ready: false,
      curation_notes: `No open-access image found. Queries: ${queries.join("; ")}. Issues: ${issues.join("; ")}`,
    }).eq("id", id);
  }

  // Log
  await supabase.from("image_curation_log").insert({
    asset_id: id, asset_code, image_type, diagnosis,
    search_queries: queries,
    selected_source: downloaded ? { name: sourceName, page_url: sourcePageUrl, image_url: bestUrl, access_type: "open" } : null,
    download_status: downloaded ? "downloaded" : "skipped",
    storage_path: "",
    classification: { asset_origin: "real_medical", validation_level: validationLevel, visual_coherence_score: coherence, diagnostic_confidence_score: confidence, multimodal_ready: false },
    issues,
    notes: `${diagnosis} (${image_type}) → ${downloaded ? "downloaded" : "not_found"}`,
  });

  return { asset_id: id, asset_code, diagnosis, diagnosis_en: diagnosisEn, status: downloaded ? "downloaded" : "not_found", source: sourceName, validation_level: validationLevel };
}

// ===== MAIN =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { image_type, batch_size = 3, offset = 0, asset_id, reprocess_all = false } = body;

    // Single asset
    if (asset_id) {
      const { data: asset } = await supabase.from("medical_image_assets")
        .select("id, asset_code, image_type, diagnosis").eq("id", asset_id).single();
      if (!asset) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const result = await processAsset(asset);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Batch
    if (!image_type) return new Response(JSON.stringify({ error: "image_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const size = Math.min(batch_size, 5);
    let query = supabase.from("medical_image_assets")
      .select("id, asset_code, image_type, diagnosis")
      .eq("image_type", image_type).eq("is_active", true);

    if (!reprocess_all) {
      query = query.or("validation_level.eq.blocked,validation_level.eq.bronze,validation_level.is.null,multimodal_ready.eq.false");
    }

    const { data: assets } = await query.order("diagnosis").range(offset, offset + size - 1);

    if (!assets?.length) {
      return new Response(JSON.stringify({ message: "No assets", results: [], summary: { processed: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    const summary = { processed: 0, downloaded: 0, not_found: 0, by_source: {} as Record<string, number> };

    for (const asset of assets) {
      const r = await processAsset(asset);
      results.push(r);
      summary.processed++;
      if (r.status === "downloaded") {
        summary.downloaded++;
        summary.by_source[r.source] = (summary.by_source[r.source] || 0) + 1;
      } else {
        summary.not_found++;
      }
      await new Promise(res => setTimeout(res, 1500));
    }

    return new Response(JSON.stringify({ results, summary, has_more: assets.length === size, next_offset: offset + assets.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
