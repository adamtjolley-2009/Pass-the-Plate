-- Running total of Claude API spend from the recipe importer, with a one-time
-- email alert when it passes a threshold. Only the importer (service role) can
-- read or change it.
CREATE TABLE public.ai_spend (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), -- exactly one row
  total_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  alert_threshold_usd NUMERIC(10, 2) NOT NULL DEFAULT 3,
  alert_email TEXT,
  alerted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_spend ENABLE ROW LEVEL SECURITY; -- no policies: hidden from app users

INSERT INTO public.ai_spend (alert_email) VALUES ('adamtjolley@gmail.com');

-- Adds one request's cost and reports whether this request crossed the threshold
-- (true only once, so the alert is sent a single time)
CREATE OR REPLACE FUNCTION public.record_ai_spend(cost_usd NUMERIC)
RETURNS TABLE (total_usd NUMERIC, alert_threshold_usd NUMERIC, alert_email TEXT, should_alert BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.ai_spend s
  SET total_usd = s.total_usd + cost_usd,
      requests = s.requests + 1,
      alerted_at = CASE
        WHEN s.alerted_at IS NULL AND s.total_usd + cost_usd >= s.alert_threshold_usd THEN now()
        ELSE s.alerted_at
      END,
      updated_at = now()
  WHERE s.id
  RETURNING s.total_usd, s.alert_threshold_usd, s.alert_email,
            (s.alerted_at IS NOT NULL AND s.alerted_at = now());
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_spend(NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_spend(NUMERIC) TO service_role;
