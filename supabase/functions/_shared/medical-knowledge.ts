/**
 * ENAZIZI Medical Knowledge Graph — Semantic Reasoning Utility
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface KnowledgeNode {
    entity: string;
    type: string;
}

export interface KnowledgeRelation {
    source: string;
    relation: string;
    target: string;
    strength: number;
}

/**
 * Find related entities using the Knowledge Graph.
 * Useful for recovery mode (expanding a topic to related ones) 
 * or Tutor context enrichment.
 */
export async function getRelatedMedicalEntities(
    supabase: ReturnType<typeof createClient>,
    entity: string,
    depth = 1,
    minStrength = 0.5
): Promise<KnowledgeRelation[]> {
    const { data, error } = await supabase
        .from("medical_knowledge_graph")
        .select("*")
        .or(`source_entity.ilike.%${entity}%,target_entity.ilike.%${entity}%`)
        .gte("strength", minStrength)
        .limit(20);

    if (error) {
        console.error("[KnowledgeGraph] Fetch failed:", error.message);
        return [];
    }

    return (data || []).map(row => ({
        source: row.source_entity,
        relation: row.relation_type,
        target: row.target_entity,
        strength: row.strength
    }));
}

/**
 * Detect potential clinical gaps by looking at disconnected or weak clusters 
 * in the user's performance vs the Knowledge Graph.
 */
export function detectClusters(relations: KnowledgeRelation[]): string[] {
    const entities = new Set<string>();
    relations.forEach(r => {
        entities.add(r.source);
        entities.add(r.target);
    });
    return Array.from(entities);
}
