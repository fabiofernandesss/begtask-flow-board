-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.user_status AS ENUM ('aguardando', 'ativo', 'bloqueado');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  foto_perfil TEXT,
  status user_status NOT NULL DEFAULT 'aguardando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create boards table
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  senha_hash TEXT NOT NULL,
  publico BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create columns table
CREATE TABLE public.columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  posicao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_entrega DATE,
  prioridade task_priority NOT NULL DEFAULT 'media',
  anexos TEXT[] DEFAULT '{}',
  posicao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  alvo TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create security definer function to check user status
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND status = 'ativo'
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for boards
CREATE POLICY "Active users can view their boards"
  ON public.boards FOR SELECT
  USING (
    public.is_user_active(auth.uid()) AND
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Active users can create boards"
  ON public.boards FOR INSERT
  WITH CHECK (
    public.is_user_active(auth.uid()) AND
    owner_id = auth.uid()
  );

CREATE POLICY "Users can update their own boards"
  ON public.boards FOR UPDATE
  USING (
    public.is_user_active(auth.uid()) AND
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can delete their own boards"
  ON public.boards FOR DELETE
  USING (
    public.is_user_active(auth.uid()) AND
    (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

-- RLS Policies for columns
CREATE POLICY "Active users can view columns from their boards"
  ON public.columns FOR SELECT
  USING (
    public.is_user_active(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE id = board_id AND
      (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Active users can manage columns in their boards"
  ON public.columns FOR ALL
  USING (
    public.is_user_active(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE id = board_id AND
      (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- RLS Policies for tasks
CREATE POLICY "Active users can view tasks from their boards"
  ON public.tasks FOR SELECT
  USING (
    public.is_user_active(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.columns c
      JOIN public.boards b ON c.board_id = b.id
      WHERE c.id = column_id AND
      (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Active users can manage tasks in their boards"
  ON public.tasks FOR ALL
  USING (
    public.is_user_active(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.columns c
      JOIN public.boards b ON c.board_id = b.id
      WHERE c.id = column_id AND
      (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their own logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Admins can view all logs"
  ON public.activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Active users can insert logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (
    public.is_user_active(auth.uid()) AND
    auth.uid() = usuario_id
  );

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true);

-- Storage policies for attachments
CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Active users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments' AND
    public.is_user_active(auth.uid())
  );

CREATE POLICY "Users can delete their attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, nome, telefone, foto_perfil, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', ''),
    COALESCE(new.raw_user_meta_data->>'telefone', ''),
    COALESCE(new.raw_user_meta_data->>'foto_perfil', NULL),
    'aguardando'
  );
  
  -- Create user role (default: user)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_columns_updated_at
  BEFORE UPDATE ON public.columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;