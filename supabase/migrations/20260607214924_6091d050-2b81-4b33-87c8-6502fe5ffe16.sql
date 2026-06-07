CREATE OR REPLACE VIEW v_exact_topic_coverage_audit AS
WITH topic_requests AS (
    SELECT 
        curriculum_competency as competency_id,
        COUNT(*) as frequency_requested,
        SUM(CASE WHEN insufficient_bank_flag THEN 1 ELSE 0 END) as failure_count,
        SUM(CASE WHEN NOT insufficient_bank_flag THEN 1 ELSE 0 END) as success_count
    FROM topic_generation_logs
    GROUP BY curriculum_competency
),
competency_stats AS (
    SELECT 
        qcs.competency_id,
        COUNT(*) as questions_total,
        COUNT(DISTINCT qcs.question_id) FILTER (WHERE qcs.is_exact_duplicate IS NOT TRUE) as questions_unique,
        COUNT(*) FILTER (WHERE qcs.quality_score >= 0.97) as questions_gold,
        COUNT(*) FILTER (WHERE qcs.audit_status = 'approved' AND qcs.quality_score >= 0.97) as questions_gold_verified,
        COUNT(*) FILTER (WHERE qcs.audit_status = 'approved' AND qcs.quality_score >= 0.98 AND qcs.classification_source = 'manual_audit') as questions_gold_verified_empirical
    FROM question_classification_staging qcs
    GROUP BY qcs.competency_id
),
alias_info AS (
    SELECT 
        competency_id,
        array_agg(alias) as active_aliases
    FROM competency_aliases
    GROUP BY competency_id
),
base_audit AS (
    SELECT 
        COALESCE(tr.competency_id, cs.competency_id) as competency_id,
        COALESCE(tr.frequency_requested, 0) as frequency_requested,
        COALESCE(cs.questions_total, 0) as questions_total,
        COALESCE(cs.questions_unique, 0) as questions_unique,
        COALESCE(cs.questions_gold, 0) as questions_gold,
        COALESCE(cs.questions_gold_verified, 0) as questions_gold_verified,
        COALESCE(cs.questions_gold_verified_empirical, 0) as questions_gold_verified_empirical,
        COALESCE(tr.success_count, 0) as success_count,
        COALESCE(tr.failure_count, 0) as failure_count,
        ai.active_aliases
    FROM topic_requests tr
    FULL OUTER JOIN competency_stats cs ON tr.competency_id = cs.competency_id
    LEFT JOIN alias_info ai ON COALESCE(tr.competency_id, cs.competency_id) = ai.competency_id
)
SELECT 
    *,
    CASE 
        WHEN questions_unique >= 100 THEN 'SUPPORTED (100+)'
        WHEN questions_unique >= 50 THEN 'SUPPORTED (50+)'
        WHEN questions_unique >= 20 THEN 'SUPPORTED (20+)'
        WHEN questions_unique >= 10 THEN 'SUPPORTED (10+)'
        ELSE 'INSUFFICIENT'
    END as max_simulado_capacity,
    CASE 
        WHEN questions_unique >= 50 AND failure_count = 0 THEN 'VERDE'
        WHEN questions_unique >= 20 OR failure_count < (frequency_requested * 0.1) THEN 'AMARELO'
        ELSE 'VERMELHO'
    END as user_impact_status,
    CASE 
        WHEN questions_unique < 20 THEN 'Cobertura insuficiente'
        WHEN active_aliases IS NULL OR array_length(active_aliases, 1) = 0 THEN 'Alias inexistente'
        WHEN failure_count > 0 AND questions_unique >= 20 THEN 'Topic Guard excessivamente restritivo'
        ELSE 'OK'
    END as root_cause
FROM base_audit;

GRANT SELECT ON v_exact_topic_coverage_audit TO authenticated;
GRANT SELECT ON v_exact_topic_coverage_audit TO service_role;
