-- Telemetry Standardization for Impact Engine
-- No actual schema change needed as event_type is text, 
-- but this migration marks the activation of these event types.

COMMENT ON COLUMN pedagogical_events.event_type IS 'Extended for ENAMED: [ENAMED_IMPACT_CALCULATED], [GAP_ANALYSIS_COMPLETED], [APPROVAL_FORECAST_UPDATED], [HIGH_IMPACT_THEME_SELECTED]';
