import { validateTutorResponse } from "./tutor-quality-validator.ts";

/**
 * AI Quality Lock Engine v2026
 * 
 * Enforces pedagogical standards on AI-generated content.
 * If a response fails validation, it registers an incident and can trigger a retry.
 */
export async function enforceQualityLock(
    supabase: any,
    payload: {
        text: string;
        userId: string;
        conversationId: string;
        module: string;
        modelUsed: string;
        requestId: string;
    }
) {
    const { text, userId, conversationId, module, modelUsed, requestId } = payload;
    
    // 1. Run validation
    const validation = validateTutorResponse(text);
    
    // 2. Log pedagogical quality
    await supabase.from("tutor_effectiveness").insert({
        user_id: userId,
        conversation_id: conversationId,
        topic: "automatic_audit",
        pedagogical_impact_score: validation.score,
        hallucination_detected: false, // Baseline: false
        created_at: new Date().toISOString()
    });

    // 3. Register Governance Incident if failed
    if (!validation.isValid) {
        await supabase.from("ai_governance_logs").insert({
            function_name: module,
            model_name: modelUsed,
            incident_type: "missing_block",
            severity: validation.score < 50 ? "critical" : "warning",
            details: {
                requestId,
                missingBlocks: validation.missingBlocks,
                presentBlocks: validation.presentBlocks,
                score: validation.score
            },
            audited_at: new Date().toISOString()
        });
        
        console.warn(`[QualityLock] Response failed validation. Score: ${validation.score}%`);
    }

    return validation;
}
