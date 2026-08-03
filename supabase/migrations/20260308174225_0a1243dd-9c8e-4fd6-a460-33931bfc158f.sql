
-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'uploader', 'viewer');

-- Create user_roles table (security best practice - roles separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⚜️',
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branches viewable by authenticated" ON public.branches
  FOR SELECT TO authenticated USING (true);

-- Insert seed branches
INSERT INTO public.branches (key, display_name, icon, sort_order) VALUES
  ('lobinho', 'Lobinho', '🐺', 1),
  ('escoteiro', 'Escoteiro', '⚜️', 2),
  ('senior', 'Sênior', '🧭', 3),
  ('pioneiro', 'Pioneiro', '🔥', 4),
  ('adulto', 'Adulto Voluntário', '🤝', 5),
  ('chefes', 'Chefes', '🎖️', 6);

-- Visibility enum
CREATE TYPE public.image_visibility AS ENUM ('private', 'group', 'public');

-- Images table
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  caption TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  consent BOOLEAN NOT NULL DEFAULT false,
  minor_age INT,
  visibility image_visibility NOT NULL DEFAULT 'group',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Admins see all images
CREATE POLICY "Admins can do anything with images" ON public.images
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Users can see their own images
CREATE POLICY "Users can view own images" ON public.images
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Public images visible to all authenticated
CREATE POLICY "Public images visible to authenticated" ON public.images
  FOR SELECT TO authenticated USING (visibility = 'public' AND (minor_age IS NULL));

-- Group images visible to authenticated (non-minor)
CREATE POLICY "Group images visible to authenticated" ON public.images
  FOR SELECT TO authenticated USING (visibility = 'group' AND (minor_age IS NULL));

-- Uploaders can insert images
CREATE POLICY "Uploaders can insert images" ON public.images
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'uploader')
    )
  );

-- Uploaders can delete own images
CREATE POLICY "Users can delete own images" ON public.images
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Upload logs table
CREATE TABLE public.upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.upload_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own logs" ON public.upload_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');

CREATE POLICY "Authenticated users can view images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'images');

CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
