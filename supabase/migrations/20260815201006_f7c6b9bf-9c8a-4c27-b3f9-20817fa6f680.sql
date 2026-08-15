CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  -- service_role / internal jobs (no JWT) bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- admins may change anything
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.role        := OLD.role;
  NEW.user_type   := OLD.user_type;
  NEW.status      := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.is_blocked  := OLD.is_blocked;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;

CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();