/**
 * repopulate-image-assets — Finds published questions without valid assets
 * and attempts to match them with existing compatible assets.
 * No AI calls — pure deterministic matching.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    // 1. Find published questions whose current asset is invalid/missing
    const { data: allPublished } = await db
      .from("medical_image_questions")
      .select("id, asset_id, statement, medical_image_assets!inner(id, is_active, review_status, integrity_status, clinical_confidence, validation_level, asset_origin, image_type, diagnosis)")
      .eq("status", "published");

    const orphans: any[] = [];
    const valid: any[] = [];

    for (const q of allPublished || []) {
      const a = (q as any).medical_image_assets;
      const isValid =
        a?.is_active === true &&
        a?.review_status === "published" &&
        a?.integrity_status === "ok" &&
        (a?.clinical_confidence ?? 0) >= 0.9 &&
        ["gold", "silver"].includes(a?.validation_level ?? "") &&
        ["real_medical", "validated_medical"].includes(a?.asset_origin ?? "");

      if (isValid) {
        valid.push(q);
      } else {
        orphans.push({ ...q, currentAsset: a });
      }
    }

    if (orphans.length === 0) {
      return jsonResp({
        success: true,
        message: "All published questions have valid assets",
        totalPublished: (allPublished || []).length,
        orphans: 0,
        repopulated: 0,
      });
    }

    // 2. Get pool of good candidate assets
    const { data: goodAssets } = await db
      .from("medical_image_assets")
      .select("id, image_type, diagnosis, specialty, subtopic, image_url")
      .eq("is_active", true)
      .eq("review_status", "published")
      .eq("integrity_status", "ok")
      .gte("clinical_confidence", 0.9)
      .in("validation_level", ["gold", "silver"])
      .in("asset_origin", ["real_medical", "validated_medical"]);

    // 3. Get already-used asset IDs to avoid duplicates
    const { data: usedAssets } = await db
      .from("medical_image_questions")
      .select("asset_id")
      .eq("status", "published");
    const usedSet = new Set((usedAssets || []).map((r: any) => r.asset_id));

    // 4. Try matching each orphan
    let repopulated = 0;
    let noMatch = 0;
    const details: any[] = [];

    for (const orphan of orphans) {
      const currentAsset = orphan.currentAsset;
      const targetType = currentAsset?.image_type;
      const targetDiag = (currentAsset?.diagnosis || "").toLowerCase();

      // Find best match: same type + similar diagnosis, not already used
      let bestMatch: any = null;
      let bestScore = 0;

      for (const candidate of goodAssets || []) {
        if (usedSet.has(candidate.id)) continue;
        if (candidate.id === orphan.asset_id) continue;

        let matchScore = 0;

        // Type match is critical
        if (candidate.image_type === targetType) matchScore += 50;
        else continue; // skip if type doesn't match

        // Diagnosis similarity
        const candDiag = (candidate.diagnosis || "").toLowerCase();
        if (candDiag && targetDiag && candDiag === targetDiag) matchScore += 40;
        else if (candDiag && targetDiag) {
          // Partial word match
          const words = targetDiag.split(/\s+/).filter((w: string) => w.length > 3);
          const matched = words.filter((w: string) => candDiag.includes(w)).length;
          matchScore += Math.min(30, matched * 10);
        }

        // Specialty match
        if (candidate.specialty && currentAsset?.specialty &&
          candidate.specialty.toLowerCase() === (currentAsset.specialty || "").toLowerCase()) {
          matchScore += 10;
        }

        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestMatch = candidate;
        }
      }

      if (bestMatch && bestScore >= 50) {
        // Update the question to point to the new asset
        await db
          .from("medical_image_questions")
          .update({ asset_id: bestMatch.id })
          .eq("id", orphan.id);

        usedSet.add(bestMatch.id);
        repopulated++;
        details.push({
          question_id: orphan.id,
          old_asset: orphan.asset_id,
          new_asset: bestMatch.id,
          match_score: bestScore,
        });
      } else {
        noMatch++;
        details.push({
          question_id: orphan.id,
          status: "no_match",
          target_type: targetType,
          target_diagnosis: targetDiag,
        });
      }
    }

    return jsonResp({
      success: true,
      totalPublished: (allPublished || []).length,
      validBefore: valid.length,
      orphans: orphans.length,
      repopulated,
      stillOrphan: noMatch,
      details,
    });
  } catch (e) {
    console.error("[repopulate-image-assets]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResp(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
