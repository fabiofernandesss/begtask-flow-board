-- Criar policy para permitir inserção e atualização de roles via service role ou autenticação admin
-- Esta policy permite qualquer usuário autenticado inserir/atualizar roles
-- (O controle de acesso real é feito na camada da aplicação via senha)

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Permitir leitura de todos os roles para usuários autenticados
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Permitir inserção de roles para usuários autenticados
CREATE POLICY "Authenticated users can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir atualização de roles para usuários autenticados
CREATE POLICY "Authenticated users can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir exclusão de roles para usuários autenticados
CREATE POLICY "Authenticated users can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (true);

-- Ajustar policies de profiles para permitir atualização de status
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Permitir usuários atualizarem seus próprios perfis
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Permitir usuários autenticados atualizarem qualquer perfil (para admin page)
CREATE POLICY "Authenticated users can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (true);