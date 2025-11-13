-- Corrigir recursão infinita nas políticas RLS de columns
-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Users can create columns in accessible boards" ON public.columns;
DROP POLICY IF EXISTS "Users can view columns from accessible boards" ON public.columns;

-- Criar políticas mais simples sem recursão

-- Policy para INSERT: usuários podem criar colunas em boards onde são owner ou admin
CREATE POLICY "Users can insert columns in their boards"
ON public.columns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards b
    WHERE b.id = columns.board_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Policy para SELECT: usuários podem ver colunas de boards públicos, que são donos, ou admins
CREATE POLICY "Users can view columns"
ON public.columns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards b
    WHERE b.id = columns.board_id
    AND (
      b.publico = true 
      OR b.owner_id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Policy adicional para SELECT permitir acesso anônimo a colunas públicas
CREATE POLICY "Public can view columns from public boards"
ON public.columns
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM boards b
    WHERE b.id = columns.board_id
    AND b.publico = true
  )
);