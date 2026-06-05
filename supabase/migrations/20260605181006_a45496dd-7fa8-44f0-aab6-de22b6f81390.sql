-- Calibrate Weights for High-Impact Themes
UPDATE enamed_impact_scores
SET 
    frequency_score = c.freq,
    approval_impact_score = c.impact,
    global_priority = c.prio,
    mastery_threshold = 80,
    updated_at = now()
FROM (VALUES 
    ('IAM', 9.8, 10.0, 9.8),
    ('Insuficiência Cardíaca', 9.5, 9.8, 9.5),
    ('Sepse', 9.2, 9.5, 9.2),
    ('HAS', 9.0, 9.2, 9.0),
    ('Diabetes Mellitus', 8.8, 9.0, 8.8),
    ('Pneumonia', 8.5, 8.8, 8.5),
    ('AVC', 8.2, 8.5, 8.2)
) AS c(theme, freq, impact, prio)
JOIN curriculum_matrix cm ON cm.tema ILIKE '%' || c.theme || '%'
WHERE enamed_impact_scores.theme_id = cm.id;
