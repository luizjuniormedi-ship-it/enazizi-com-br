-- SECURITY INCIDENT NOTE:
-- Historical Google service-account credential material was removed from this
-- migration after rotation. Runtime Drive access is configured exclusively via
-- encrypted Edge Function secrets (GOOGLE_SA_EMAIL and
-- GOOGLE_SA_PRIVATE_KEY_B64); fresh environments must not recreate the revoked
-- Vault entries that previously lived here.
SELECT 1;
