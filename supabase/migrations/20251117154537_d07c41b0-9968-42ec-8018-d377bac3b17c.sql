-- Remover políticas antigas que estão muito restritivas
DROP POLICY IF EXISTS "Admins podem gerenciar todos os acessos" ON public.user_board_access;
DROP POLICY IF EXISTS "Board owners podem gerenciar acessos dos seus boards" ON public.user_board_access;

-- Criar política mais permissiva para usuários autenticados gerenciarem acessos
-- (a página admin já tem sua própria autenticação por senha)
CREATE POLICY "Authenticated users can manage board access"
ON public.user_board_access
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);