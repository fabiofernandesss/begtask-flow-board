-- Criar tabela auxiliar para linkar usuários a boards
CREATE TABLE public.user_board_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, board_id)
);

-- Enable RLS
ALTER TABLE public.user_board_access ENABLE ROW LEVEL SECURITY;

-- Políticas para user_board_access
CREATE POLICY "Admins podem gerenciar todos os acessos"
ON public.user_board_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Board owners podem gerenciar acessos dos seus boards"
ON public.user_board_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = board_id AND b.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = board_id AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "Users podem ver seus próprios acessos"
ON public.user_board_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Função para verificar se usuário tem acesso a um board
CREATE OR REPLACE FUNCTION public.user_has_board_access(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_board_access
    WHERE user_id = _user_id AND board_id = _board_id
  )
$$;

-- Atualizar políticas de boards para considerar user_board_access
DROP POLICY IF EXISTS "editor_visualizador_view_boards" ON public.boards;

CREATE POLICY "users_with_access_view_boards"
ON public.boards
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_has_board_access(auth.uid(), id)
);

-- Atualizar políticas de columns
DROP POLICY IF EXISTS "editor_visualizador_view_columns" ON public.columns;

CREATE POLICY "users_with_board_access_manage_columns"
ON public.columns
FOR ALL
TO authenticated
USING (
  user_owns_column_board(auth.uid(), board_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_has_board_access(auth.uid(), board_id)
)
WITH CHECK (
  user_owns_column_board(auth.uid(), board_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_has_board_access(auth.uid(), board_id)
);

-- Atualizar políticas de tasks
DROP POLICY IF EXISTS "editor_view_tasks" ON public.tasks;
DROP POLICY IF EXISTS "visualizador_view_tasks" ON public.tasks;

CREATE POLICY "users_with_board_access_manage_tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR user_owns_column_board(auth.uid(), column_id)
  OR user_is_task_participant(auth.uid(), id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.columns c
    WHERE c.id = column_id AND user_has_board_access(auth.uid(), c.board_id)
  )
)
WITH CHECK (
  user_owns_column_board(auth.uid(), column_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.columns c
    WHERE c.id = column_id AND user_has_board_access(auth.uid(), c.board_id)
  )
);

-- Criar índices para performance
CREATE INDEX idx_user_board_access_user_id ON public.user_board_access(user_id);
CREATE INDEX idx_user_board_access_board_id ON public.user_board_access(board_id);