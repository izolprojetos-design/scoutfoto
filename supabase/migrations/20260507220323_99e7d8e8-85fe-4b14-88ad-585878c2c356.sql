-- Enum for achievement types
DO $$ BEGIN
  CREATE TYPE public.achievement_type AS ENUM ('especialidade', 'insignia', 'distintivo', 'conquista', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.scout_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL,
  type public.achievement_type NOT NULL DEFAULT 'conquista',
  name text NOT NULL,
  achievement_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scout_achievements_scout ON public.scout_achievements(scout_id, achievement_date DESC);

ALTER TABLE public.scout_achievements ENABLE ROW LEVEL SECURITY;

-- View: section-based, mirroring scout_photos pattern
CREATE POLICY "Section-based view scout_achievements"
ON public.scout_achievements FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'voluntario'::app_role)
      OR has_role(auth.uid(), 'dirigente_gestor'::app_role)
      OR has_permission(auth.uid(), 'manage_scouts'::text))
    AND EXISTS (
      SELECT 1 FROM public.scouts s
      WHERE s.id = scout_achievements.scout_id
        AND (
          get_user_section(auth.uid()) IS NULL
          OR get_user_section(auth.uid()) = ''
          OR s.section = get_user_section(auth.uid())
        )
    )
  )
);

CREATE POLICY "Admins voluntarios can insert scout_achievements"
ON public.scout_achievements FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'voluntario'::app_role))
);

CREATE POLICY "Owners or admins update scout_achievements"
ON public.scout_achievements FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners admins voluntarios delete scout_achievements"
ON public.scout_achievements FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'voluntario'::app_role)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_scout_achievements_updated_at
BEFORE UPDATE ON public.scout_achievements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();