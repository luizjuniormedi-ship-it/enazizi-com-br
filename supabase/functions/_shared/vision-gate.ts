// ── ENAZIZI Vision Gate: fail-closed policy ──
// imagem suspeita = rejeitado | visão falhou = rejeitado
// diagnóstico não bate = rejeitado | retrato detectado = rejeitado

const BLOCKED_URL_PATTERNS = [
  "logo", "icon", "avatar", "banner", "favicon", "tracking", "ad-",
  "thumbnail", "thumb", "social", "share", "button", "arrow", "caret",
  "chevron", "loading", "spinner", "skeleton", "gradient", "overlay",
  "watermark", "badge", "ribbon", "emoji", "smiley", "screenshot",
  "mockup", "wireframe", "ui-", "ux-", "portrait", "selfie",
  "headshot", "profile-pic", "profile-photo", "profile_photo",
  "author", "staff", "team-photo", "team_photo", "doctor-photo",
  "physician", "nurse", "speaker", "editor", "faculty", "contributor",
  "person-photo", "person_photo", "people", "member", "bio-photo",
  "about-us", "corporate", "company", "branding", "institutional",
  "clipart", "cartoon", "illustration", "vector", "flat-design",
  "shutterstock", "gettyimages", "istockphoto", "dreamstime",
  "unsplash.com", "pexels.com", "pixabay.com",
  "youtube.com/", "vimeo.com/", "pinterest", "instagram", "facebook",
  "certificate", "award", "trophy", "infographic", "chart-image",
  "graph-image", "hero-image", "feature-image", "banner-image",
  "quality-index", "life-quality", "questionnaire", "survey",
];

export function isUrlSuspicious(url: string | null | undefined): { suspicious: boolean; reason?: string } {
  if (!url || typeof url !== "string" || url.trim().length < 10) {
    return { suspicious: true, reason: "URL ausente ou inválida" };
  }
  const lower = url.toLowerCase();
  for (const p of BLOCKED_URL_PATTERNS) {
    if (lower.includes(p)) return { suspicious: true, reason: `URL contém "${p}"` };
  }
  return { suspicious: false };
}

export function isHtmlImageBlocked(src: string, fullTag = ""): boolean {
  const haystack = `${src} ${fullTag}`.toLowerCase();
  return BLOCKED_URL_PATTERNS.some(p => haystack.includes(p));
}

export function extractCleanImageUrls(html: string): string[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    const fullTag = match[0].toLowerCase();
    if (!src.startsWith("http")) continue;
    if (isHtmlImageBlocked(src, fullTag)) continue;
    const srcLower = src.toLowerCase();
    if (
      !(srcLower.endsWith(".jpg") || srcLower.endsWith(".jpeg") ||
        srcLower.endsWith(".png") || srcLower.endsWith(".webp") ||
        srcLower.includes("/images/"))
    ) continue;
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch?.[1]?.toLowerCase() || "";
    if (isHtmlImageBlocked(srcLower, alt) || alt.includes("chart") || alt.includes("graph") || alt.includes("infographic")) continue;
    urls.push(src);
  }
  return urls;
}

/**
 * FAIL-CLOSED vision validation using OpenAI via Lovable Gateway.
 * Any failure = { valid: false }. Never allow on error.
 */
export async function validateImageVision(
  imageUrl: string,
  expectedDiagnosis: string,
  imageType: string,
  apiKey: string | undefined,
): Promise<{ valid: boolean; reason: string }> {
  if (!apiKey) return { valid: false, reason: "LOVABLE_API_KEY ausente — rejeitado" };
  if (!imageUrl) return { valid: false, reason: "URL de imagem ausente" };

  try {
    const payload = {
      model: "openai/gpt-5-mini",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a STRICT medical image auditor. Your job is to REJECT anything that is NOT a real clinical image.

REJECT immediately if the image is:
- A human portrait, headshot, selfie, profile photo, team photo, staff photo
- A doctor, nurse, physician, or any person (not a patient exam)
- A website screenshot, UI mockup, infographic, chart, diagram
- A logo, icon, badge, certificate, illustration, cartoon
- A stock photo, marketing image, device photo
- Any image that is NOT directly a medical exam result

ACCEPT only if the image is a real clinical image (ECG tracing, X-ray, CT scan, ultrasound, dermatology lesion photo, histopathology slide, fundoscopy, etc.)

Expected diagnosis: "${expectedDiagnosis}"
Expected modality: "${imageType}"

Return ONLY valid JSON: {"is_clinical":true/false,"matches_diagnosis":true/false,"contains_portrait":true/false,"reason":"brief reason"}`,
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
      max_completion_tokens: 300,
      response_format: { type: "json_object" }
    };

    console.log("[VisionGate] Payload:", JSON.stringify(payload, null, 2));

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.clone().text();
      console.error(`[VisionGate] Lovable AI Gateway Error ${resp.status}:`, errText);
      return { valid: false, reason: `Vision API erro ${resp.status} — rejeitado` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("[VisionGate] Response content:", content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { valid: false, reason: "Resposta de visão inválida — rejeitado" };

    const result = JSON.parse(jsonMatch[0]);
    if (result.contains_portrait) return { valid: false, reason: `Retrato humano detectado: ${result.reason || "portrait"}` };
    if (!result.is_clinical) return { valid: false, reason: `Imagem não clínica: ${result.reason || "não é exame"}` };
    if (!result.matches_diagnosis) return { valid: false, reason: `Diagnóstico não bate: ${result.reason || "mismatch"}` };

    return { valid: true, reason: result.reason || "Validado" };
  } catch (err) {
    console.error("[VisionGate] Exception:", err);
    return { valid: false, reason: `Visão falhou: ${(err as Error).message} — rejeitado` };
  }
}
