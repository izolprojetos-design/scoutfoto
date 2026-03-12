
-- Step 1: Migrate data
UPDATE public.user_roles SET role = 'viewer' WHERE role = 'uploader';
DELETE FROM public.role_permissions WHERE role = 'uploader';

-- Step 2: Drop ALL policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything with images" ON public.images;
DROP POLICY IF EXISTS "Uploaders can insert images" ON public.images;
DROP POLICY IF EXISTS "Authenticated with permission can insert images" ON public.images;
DROP POLICY IF EXISTS "Admins can view logs" ON public.upload_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage events" ON public.events;
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete events" ON public.events;
DROP POLICY IF EXISTS "Uploaders can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated with role can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage scouts" ON public.scouts;
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete scouts" ON public.scouts;
DROP POLICY IF EXISTS "Uploaders can insert scouts" ON public.scouts;
DROP POLICY IF EXISTS "Authenticated with role can insert scouts" ON public.scouts;
DROP POLICY IF EXISTS "Uploaders can update own scouts" ON public.scouts;
DROP POLICY IF EXISTS "Authenticated with role can update scouts" ON public.scouts;
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage guardians" ON public.guardians;
DROP POLICY IF EXISTS "Admins chefes dirigentes can delete guardians" ON public.guardians;
DROP POLICY IF EXISTS "Uploaders can insert guardians" ON public.guardians;
DROP POLICY IF EXISTS "Authenticated with role can insert guardians" ON public.guardians;
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage share links" ON public.event_share_links;
DROP POLICY IF EXISTS "Uploaders can insert share links" ON public.event_share_links;
DROP POLICY IF EXISTS "Authenticated with role can insert share links" ON public.event_share_links;
DROP POLICY IF EXISTS "Chefes and dirigentes can view all images" ON public.images;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins chefes dirigentes can manage event_permissions" ON public.event_permissions;
DROP POLICY IF EXISTS "Authenticated with role can insert images" ON public.images;

-- Step 3: Drop functions
DROP FUNCTION IF EXISTS public.has_role;
DROP FUNCTION IF EXISTS public.has_permission;
DROP FUNCTION IF EXISTS public.has_event_permission;

-- Step 4: Drop default, rename enum, create new
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer', 'chefe', 'parent', 'dirigente', 'dirigente_gestor');

-- Step 5: Convert columns
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'viewer'::app_role;

-- Step 6: Drop old enum
DROP TYPE public.app_role_old;

-- Step 7: Recreate functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND p.key = _permission_key
) $$;

CREATE OR REPLACE FUNCTION public.has_event_permission(_user_id uuid, _event_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.event_permissions
  WHERE user_id = _user_id AND event_id = _event_id
  AND ((_permission = 'view' AND can_view = true) OR (_permission = 'upload' AND can_upload = true)
    OR (_permission = 'download' AND can_download = true) OR (_permission = 'manage' AND can_manage = true))
) $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer'::app_role);
  RETURN NEW;
END;
$function$;

-- Step 8: Recreate ALL policies
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can do anything with images" ON public.images FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Chefes and dirigentes can view all images" ON public.images FOR SELECT TO authenticated USING (has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Authenticated can insert images" ON public.images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role)));
CREATE POLICY "Admins can view logs" ON public.upload_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins chefes dirigentes can manage events" ON public.events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Admins chefes dirigentes can delete events" ON public.events FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Admins chefes dirigentes can manage scouts" ON public.scouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Admins chefes dirigentes can delete scouts" ON public.scouts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Can insert scouts" ON public.scouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role)));
CREATE POLICY "Can update scouts" ON public.scouts FOR UPDATE TO authenticated USING (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role))) WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role)));
CREATE POLICY "Admins chefes dirigentes can manage guardians" ON public.guardians FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Admins chefes dirigentes can delete guardians" ON public.guardians FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Can insert guardians" ON public.guardians FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role)));
CREATE POLICY "Admins chefes dirigentes can manage share links" ON public.event_share_links FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
CREATE POLICY "Can insert share links" ON public.event_share_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role)));
CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins chefes dirigentes can manage event_permissions" ON public.event_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'chefe'::app_role) OR has_role(auth.uid(), 'dirigente'::app_role));
