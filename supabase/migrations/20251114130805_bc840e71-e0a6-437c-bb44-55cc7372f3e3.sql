-- CRIAR FUNÇÕES SECURITY DEFINER PARA TASK_PARTICIPANTS
CREATE OR REPLACE FUNCTION public.user_can_manage_task_participants(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    INNER JOIN public.columns c ON t.column_id = c.id
    INNER JOIN public.boards b ON c.board_id = b.id
    WHERE t.id = _task_id
    AND (
      b.owner_id = _user_id 
      OR t.created_by = _user_id 
      OR t.responsavel_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.task_participants tp 
        WHERE tp.task_id = _task_id AND tp.user_id = _user_id
      )
    )
  )
$$;

-- REMOVER POLÍTICAS ANTIGAS DE TASK_PARTICIPANTS
DROP POLICY IF EXISTS "Users can add task participants" ON public.task_participants;
DROP POLICY IF EXISTS "Users can remove task participants" ON public.task_participants;
DROP POLICY IF EXISTS "Users can update task participants" ON public.task_participants;
DROP POLICY IF EXISTS "Users can view task participants" ON public.task_participants;

-- CRIAR NOVAS POLÍTICAS PARA TASK_PARTICIPANTS SEM RECURSÃO
CREATE POLICY "user_view_task_participants"
ON public.task_participants
FOR SELECT
TO authenticated
USING (public.user_can_manage_task_participants(auth.uid(), task_id));

CREATE POLICY "user_add_task_participants"
ON public.task_participants
FOR INSERT
TO authenticated
WITH CHECK (public.user_can_manage_task_participants(auth.uid(), task_id));

CREATE POLICY "user_update_task_participants"
ON public.task_participants
FOR UPDATE
TO authenticated
USING (public.user_can_manage_task_participants(auth.uid(), task_id));

CREATE POLICY "user_remove_task_participants"
ON public.task_participants
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR public.user_can_manage_task_participants(auth.uid(), task_id)
);

-- AJUSTAR POLÍTICA DE UPDATE DE TASKS PARA INCLUIR PARTICIPANTES
-- Remover política antiga de update
DROP POLICY IF EXISTS "user_update_own_tasks" ON public.tasks;

-- Recriar com participantes podendo atualizar (mas não deletar)
CREATE POLICY "user_update_own_tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
  OR public.user_is_task_participant(auth.uid(), id)
);