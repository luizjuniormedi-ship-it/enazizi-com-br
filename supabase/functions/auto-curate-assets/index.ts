import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping: image_type -> Open-i search queries
const SEARCH_QUERIES: Record<string, string[]> = {
  xray: [
    "chest xray pneumonia", "chest radiograph tuberculosis", "chest xray COPD",
    "chest xray pleural effusion", "chest xray cardiomegaly", "chest xray atelectasis",
    "chest xray lung mass", "chest radiograph normal"
  ],
  ecg: [
    "electrocardiogram atrial fibrillation", "ECG myocardial infarction",
    "electrocardiogram ventricular tachycardia", "ECG AV block",
    "electrocardiogram sinus bradycardia", "ECG bundle branch block",
    "electrocardiogram normal sinus rhythm"
  ],
  dermatology: [
    "dermatology psoriasis", "skin melanoma dermoscopy", "dermatology urticaria",
    "herpes zoster skin", "dermatology lupus rash", "skin eczema",
    "dermatology basal cell carcinoma", "skin fungal infection"
  ],
  ct: [
    "CT brain stroke", "CT head hemorrhage", "CT scan pulmonary embolism",
    "CT abdomen appendicitis", "CT scan kidney stone", "CT brain meningioma",
    "CT chest lung nodule"
  ],
  ophthalmology: [
    "fundoscopy diabetic retinopathy", "eye glaucoma optic disc",
    "retinal detachment fundus", "macular degeneration OCT",
    "eye cataract slit lamp", "optic neuritis fundoscopy"
  ],
  us: [
    "ultrasound gallstone cholecystitis", "ultrasound kidney hydronephrosis",
    "ultrasound thyroid nodule", "obstetric ultrasound", "ultrasound DVT"
  ],
  pathology: [
    "histopathology breast carcinoma", "pathology cervical CIN",
    "histology colon adenocarcinoma", "pathology lung squamous cell"
  ],
};

// PT diagnosis labels for registration
const DIAGNOSIS_MAP: Record<string, Record<string, string>> = {
  xray: {
    pneumonia: "Pneumonia", tuberculosis: "Tuberculose", COPD: "DPOC",
    "pleural effusion": "Derrame pleural", cardiomegaly: "Cardiomegalia",
    atelectasis: "Atelectasia", "lung mass": "Massa pulmonar", normal: "Normal",
  },
  ecg: {
    "atrial fibrillation": "Fibrilação atrial", "myocardial infarction": "Infarto agudo do miocárdio",
    "ventricular tachycardia": "Taquicardia ventricular", "AV block": "Bloqueio AV",
    "sinus bradycardia": "Bradicardia sinusal", "bundle branch block": "Bloqueio de ramo",
    "normal sinus": "Ritmo sinusal normal",
  },
  dermatology: {
    psoriasis: "Psoríase", melanoma: "Melanoma", urticaria: "Urticária",
    "herpes zoster": "Herpes zóster", lupus: "Lúpus eritematoso",
    eczema: "Eczema", "basal cell": "Carcinoma basocelular", fungal: "Micose cutânea",
  },
  ct: {
    stroke: "AVC isquêmico", hemorrhage: "AVC hemorrágico",
    "pulmonary embolism": "Tromboembolismo pulmonar", appendicitis: "Apendicite",
    "kidney stone": "Litíase renal", meningioma: "Meningioma", "lung nodule": "Nódulo pulmonar",
  },
  ophthalmology: {
    "diabetic retinopathy": "Retinopatia diabética", glaucoma: "Glaucoma",
    "retinal detachment": "Descolamento de retina", "macular degeneration": "Degeneração macular",
    cataract: "Catarata", "optic neuritis": "Neurite óptica",
  },
  us: {
    gallstone: "Colelitíase", hydronephrosis: "Hidronefrose",
    "thyroid nodule": "Nódulo tireoidiano", obstetric: "Obstetrícia", DVT: "Trombose venosa profunda",
  },
  pathology: {
    "breast carcinoma": "Carcinoma de mama", "cervical CIN": "NIC cervical",
    "colon adenocarcinoma": "Adenocarcinoma colônico", "squamous cell": "Carcinoma espinocelular",
  },
};

const SPECIALTY_MAP: Record<string, string> = {
  xray: "Pneumologia", ecg: "Cardiologia", dermatology: "Dermatologia",
  ct: "Neurorradiologia", ophthalmology: "Oftalmologia", us: "Radiologia",
  pathology: "Patologia",
};

interface OpenIResult {
  imgLarge?: string;
  imgThumb?: string;
  title?: string;
  abstract?: string;
  uid?: string;
}

async function searchOpenI(query: string, maxResults = 10): Promise<OpenIResult[]> {
  const url = `https://openi.nlm.nih.gov/api/search?query=${encodeURIComponent(query)}&m=1&n=${maxResults}&it=x,p,ct,m,u`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.list || [];
  } catch {
    return [];
  }
}

function inferDiagnosis(query: string, imageType: string): string {
  const map = DIAGNOSIS_MAP[imageType] || {};
  const lowerQ = query.toLowerCase();
  for (const [key, label] of Object.entries(map)) {
    if (lowerQ.includes(key.toLowerCase())) return label;
  }
  return "A classificar";
}

function inferDifficulty(query: string): string {
  if (query.match(/normal|sinus/i)) return "easy";
  if (query.match(/mass|embolism|hemorrhage|melanoma|carcinoma/i)) return "hard";
  return "medium";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { image_type, max_per_query = 5, dry_run = false } = await req.json();

    if (!image_type || !SEARCH_QUERIES[image_type]) {
      return new Response(
        JSON.stringify({ error: `Invalid image_type. Options: ${Object.keys(SEARCH_QUERIES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const queries = SEARCH_QUERIES[image_type];
    const specialty = SPECIALTY_MAP[image_type] || "Clínica Médica";

    // Get existing image URLs to avoid duplicates
    const { data: existingAssets } = await supabase
      .from("medical_image_assets")
      .select("image_url")
      .eq("image_type", image_type);
    const existingUrls = new Set((existingAssets || []).map((a: any) => a.image_url));

    const results: Array<{ query: string; found: number; registered: number; skipped: number }> = [];
    let totalRegistered = 0;

    for (const query of queries) {
      const items = await searchOpenI(query, max_per_query);
      let registered = 0;
      let skipped = 0;

      for (const item of items) {
        const imageUrl = item.imgLarge || item.imgThumb;
        if (!imageUrl) { skipped++; continue; }

        const fullUrl = imageUrl.startsWith("http") ? imageUrl : `https://openi.nlm.nih.gov${imageUrl}`;

        if (existingUrls.has(fullUrl)) { skipped++; continue; }

        const diagnosis = inferDiagnosis(query, image_type);
        const difficulty = inferDifficulty(query);
        const assetCode = `${image_type}_openi_${item.uid || crypto.randomUUID().slice(0, 8)}`;

        if (dry_run) {
          registered++;
          existingUrls.add(fullUrl);
          continue;
        }

        const { error } = await supabase
          .from("medical_image_assets")
          .insert({
            image_type,
            diagnosis,
            difficulty,
            image_url: fullUrl,
            is_active: true,
            question_generated: false,
            review_status: "pending",
            clinical_confidence: 0.7,
            specialty,
            subtopic: diagnosis,
            asset_code: assetCode,
            asset_origin: "openi_nlm_auto",
            license_type: "Open Access (NIH)",
            incidence_weight: 1.0,
            clinical_findings: {},
            distractors: [],
            tri_a: 1.0,
            tri_b: 0.0,
            tri_c: 0.25,
            version: 1,
          });

        if (!error) {
          registered++;
          totalRegistered++;
          existingUrls.add(fullUrl);
        } else {
          skipped++;
        }
      }

      results.push({ query, found: items.length, registered, skipped });
    }

    return new Response(
      JSON.stringify({
        image_type,
        dry_run,
        total_registered: totalRegistered,
        queries_processed: results.length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
