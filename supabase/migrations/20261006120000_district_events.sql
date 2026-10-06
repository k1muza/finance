-- ============================================================
-- District calendar events
--
-- Plain calendar items (services, conferences, meetings). Not
-- financial records, so hard delete is allowed.
--
-- Dates are stored as DATE (+ optional TIME) rather than
-- TIMESTAMPTZ so an event on "12 Oct" stays on 12 Oct for every
-- viewer regardless of browser timezone. start_time NULL = all day.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.district_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id  UUID         NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  title        TEXT         NOT NULL CHECK (length(btrim(title)) > 0),
  description  TEXT,
  location     TEXT,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  start_time   TIME,
  end_time     TIME,
  created_by   UUID         REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT district_events_date_order CHECK (end_date >= start_date),
  CONSTRAINT district_events_end_time_needs_start CHECK (end_time IS NULL OR start_time IS NOT NULL),
  CONSTRAINT district_events_time_order CHECK (
    end_date > start_date OR end_time IS NULL OR end_time >= start_time
  )
);

CREATE INDEX IF NOT EXISTS idx_district_events_district_dates
  ON public.district_events(district_id, start_date, end_date);

DROP TRIGGER IF EXISTS trg_district_events_updated_at ON public.district_events;
CREATE TRIGGER trg_district_events_updated_at
  BEFORE UPDATE ON public.district_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mirrors 'events.manage' in src/lib/auth/permissions.ts.
CREATE OR REPLACE FUNCTION public.can_manage_district_events(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('admin', 'secretary')
  );
$$;

ALTER TABLE public.district_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "district_member_read_events" ON public.district_events;
CREATE POLICY "district_member_read_events"
  ON public.district_events FOR SELECT
  USING (public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_manager_insert_events" ON public.district_events;
CREATE POLICY "district_manager_insert_events"
  ON public.district_events FOR INSERT
  WITH CHECK (public.can_manage_district_events(district_id));

DROP POLICY IF EXISTS "district_manager_update_events" ON public.district_events;
CREATE POLICY "district_manager_update_events"
  ON public.district_events FOR UPDATE
  USING (public.can_manage_district_events(district_id))
  WITH CHECK (public.can_manage_district_events(district_id));

DROP POLICY IF EXISTS "district_manager_delete_events" ON public.district_events;
CREATE POLICY "district_manager_delete_events"
  ON public.district_events FOR DELETE
  USING (public.can_manage_district_events(district_id));
