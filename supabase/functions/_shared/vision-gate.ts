// ── ENAZIZI Vision Gate: fail-closed policy ──
// imagem suspeita = rejeitado | visão falhou = rejeitado
// diagnóstico não bate = rejeitado | retrato detectado = rejeitado

import { aiFetch } from "./ai-fetch.ts";
import { parseAiJson } from "./enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "./ai-model-registry.ts";

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
 * FAIL-CLOSED vision validation using OpenAI via aiFetch (Safe Mode compatible).
 */
export async function validateImageVision(
  imageUrl: string,
  expectedDiagnosis: string,
  imageType: string,
  apiKey: string | undefined,
): Promise<{ valid: boolean; reason: string }> {
  if (!imageUrl) return { valid: false, reason: "URL de imagem ausente" };

  try {
    const messages = [{
      role: "user" as const,
      content: [
        {
          type: "text",
          text: `You are a medical auditor. Respond ONLY with valid JSON.
Verify if the image is a REAL clinical exam (X-ray, ECG, US, etc.) matching "${expectedDiagnosis}" (${imageType}).
REJECT infographics, diagrams, or portraits.
JSON: {"is_clinical":bool, "matches_diagnosis":bool, "reason":"string"}`,
        },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    }];

    const resp = await aiFetch({
      model: ALLOWED_MODELS.generation, // Uses google/gemini-2.5-flash in safe mode
      messages: messages as any,
      timeoutMs: 50000,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { valid: false, reason: `Gateway error ${resp.status}: ${errText.slice(0,100)}` };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const result = parseAiJson(content);

    if (!result.is_clinical) return { valid: false, reason: `Não é imagem clínica: ${result.reason}` };
    if (!result.matches_diagnosis) return { valid: false, reason: `Diagnóstico divergente: ${result.reason}` };

    return { valid: true, reason: result.reason || "Validado" };
  } catch (err) {
    return { valid: false, reason: `Falha de visão: ${(err as Error).message}` };
  }
}
