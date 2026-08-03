
-- Add dirigente to all RLS policies that currently include chefe

-- events: manage
DROP POLICY IF EXISTS "Admins and chefes can manage events" ON public.events;
CREATE POLICY "Admins chefes dirigentes can manage events"
ON public.events FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- events: delete
DROP POLICY IF EXISTS "Admins and chefes can delete events" ON public.events;
CREATE POLICY "Admins chefes dirigentes can delete events"
ON public.events FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- events: insert (uploaders)
DROP POLICY IF EXISTS "Uploaders can insert events" ON public.events;
CREATE POLICY "Uploaders can insert events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader'));

-- scouts: manage
DROP POLICY IF EXISTS "Admins and chefes can manage scouts" ON public.scouts;
CREATE POLICY "Admins chefes dirigentes can manage scouts"
ON public.scouts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- scouts: delete
DROP POLICY IF EXISTS "Admins and chefes can delete scouts" ON public.scouts;
CREATE POLICY "Admins chefes dirigentes can delete scouts"
ON public.scouts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- scouts: insert (uploaders)
DROP POLICY IF EXISTS "Uploaders can insert scouts" ON public.scouts;
CREATE POLICY "Uploaders can insert scouts"
ON public.scouts FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader')));

-- scouts: update (uploaders)
DROP POLICY IF EXISTS "Uploaders can update own scouts" ON public.scouts;
CREATE POLICY "Uploaders can update own scouts"
ON public.scouts FOR UPDATE
TO authenticated
USING ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader')))
WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader')));

-- guardians: manage
DROP POLICY IF EXISTS "Admins and chefes can manage guardians" ON public.guardians;
CREATE POLICY "Admins chefes dirigentes can manage guardians"
ON public.guardians FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- guardians: delete
DROP POLICY IF EXISTS "Admins and chefes can delete guardians" ON public.guardians;
CREATE POLICY "Admins chefes dirigentes can delete guardians"
ON public.guardians FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- guardians: insert (uploaders)
DROP POLICY IF EXISTS "Uploaders can insert guardians" ON public.guardians;
CREATE POLICY "Uploaders can insert guardians"
ON public.guardians FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader')));

-- event_share_links: manage
DROP POLICY IF EXISTS "Admins and chefes can manage share links" ON public.event_share_links;
CREATE POLICY "Admins chefes dirigentes can manage share links"
ON public.event_share_links FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));

-- event_share_links: insert (uploaders)
DROP POLICY IF EXISTS "Uploaders can insert share links" ON public.event_share_links;
CREATE POLICY "Uploaders can insert share links"
ON public.event_share_links FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = created_by) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente') OR has_role(auth.uid(), 'uploader')));

-- images: chefes can view all
DROP POLICY IF EXISTS "Chefes can view all images" ON public.images;
CREATE POLICY "Chefes and dirigentes can view all images"
ON public.images FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'chefe') OR has_role(auth.uid(), 'dirigente'));
