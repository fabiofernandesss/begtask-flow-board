-- Atualizar política RLS para permitir que todos os usuários autenticados vejam todos os boards
DROP POLICY IF EXISTS "Active users can view their boards" ON public.boards;

CREATE POLICY "Active users can view all boards"
ON public.boards
FOR SELECT
USING (is_user_active(auth.uid()));