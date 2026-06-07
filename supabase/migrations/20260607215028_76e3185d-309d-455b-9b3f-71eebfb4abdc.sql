DROP VIEW IF EXISTS v_exact_topic_coverage_audit;

CREATE VIEW v_exact_topic_coverage_audit AS
WITH topic_requests AS (
    SELECT 
        curriculum_competency as requested_name,
        COUNT(*) as frequency_requested,
        SUM(CASE WHEN insufficient_bank_flag THEN 1 ELSE 0 END) as failure_count
    FROM topic_generation_logs
    GROUP BY curriculum_competency
),
competency_stats AS (
    SELECT 
        qcs.competency_id,
        COUNT(*) as questions_total,
        COUNT(DISTINCT qcs.question_id) FILTER (WHERE qcs.is_exact_duplicate IS NOT TRUE) as questions_unique,
        COUNT(*) FILTER (WHERE qcs.quality_score >= 0.97) as questions_gold,
        COUNT(*) FILTER (WHERE qcs.audit_status = 'approved' AND qcs.quality_score >= 0.97) as questions_gold_verified
    FROM question_classification_staging qcs
    GROUP BY qcs.competency_id
),
alias_info AS (
    SELECT 
        topic_id as competency_id,
        array_agg(alias) as active_aliases
    FROM curriculum_aliases
    GROUP BY topic_id
)
SELECT 
    cr.id as registry_id,
    cr.curriculum_competency as competency_name,
    COALESCE(tr.frequency_requested, 0) as frequency_requested,
    COALESCE(cs.questions_total, 0) as questions_total,
    COALESCE(cs.questions_unique, 0) as questions_unique,
    COALESCE(cs.questions_gold, 0) as questions_gold,
    COALESCE(cs.questions_gold_verified, 0) as questions_gold_verified,
    COALESCE(tr.failure_count, 0) as failure_count,
    ai.active_aliases,
    CASE 
        WHEN COALESCE(cs.questions_unique, 0) >= 100 THEN 'SUPPORTED (100+)'
        WHEN COALESCE(cs.questions_unique, 0) >= 50 THEN 'SUPPORTED (50+)'
        WHEN COALESCE(cs.questions_unique, 0) >= 20 THEN 'SUPPORTED (20+)'
        WHEN COALESCE(cs.questions_unique, 0) >= 10 THEN 'SUPPORTED (10+)'
        ELSE 'INSUFFICIENT'
    END as max_simulado_capacity,
    CASE 
        WHEN COALESCE(cs.questions_unique, 0) >= 50 AND COALESCE(tr.failure_count, 0) = 0 THEN 'VERDE'
        WHEN COALESCE(cs.questions_unique, 0) >= 20 OR (tr.frequency_requested > 0 AND tr.failure_count::float / NULLIF(tr.frequency_requested, 0) < 0.1) THEN 'AMARELO'
        ELSE 'VERMELHO'
    END as user_impact_status,
    CASE 
        WHEN COALESCE(cs.questions_unique, 0) < 20 THEN 'Cobertura insuficiente'
        WHEN ai.active_aliases IS NULL OR array_length(ai.active_aliases, 1) = 0 THEN 'Alias inexistente'
        WHEN COALESCE(tr.failure_count, 0) > 0 AND COALESCE(cs.questions_unique, 0) >= 20 THEN 'Topic Guard excessivamente restritivo'
        ELSE 'OK'
    END as root_cause
FROM curriculum_registry cr
LEFT JOIN topic_requests tr ON cr.curriculum_competency = tr.requested_name
LEFT JOIN competency_stats cs ON cr.id::text = cs.competency_id OR cr.competency_id = cs.competency_id
LEFT JOIN alias_info ai ON cr.id = ai.competency_id;

GRANT SELECT ON v_exact_topic_coverage_audit TO authenticated;
GRANT SELECT ON v_exact_topic_coverage_audit TO service_role;
