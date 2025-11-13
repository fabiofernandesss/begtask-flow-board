-- REMOVER TODAS AS POLÍTICAS EXISTENTES DA TABELA TASKS
DROP POLICY IF EXISTS "Admin can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can delete all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Public can view tasks from public boards" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their boards" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can create tasks in own boards" ON public.tasks;
DROP POLICY IF EXISTS "User can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can delete own tasks" ON public.tasks;

-- Verificar se as funções security definer existem
CREATE OR REPLACE FUNCTION public.user_owns_column_board(_user_id uuid, _column_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.columns c
    INNER JOIN public.boards b ON c.board_id = b.id
    WHERE c.id = _column_id
    AND b.owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_task_participant(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_participants
    WHERE task_id = _task_id
    AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_public_board_task(_task_id uuid)
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
    AND b.publico = true
  )
$$;

-- CRIAR POLÍTICAS LIMPAS SEM RECURSÃO

-- SELECT: Público pode ver tasks de boards públicos
CREATE POLICY "public_view_public_tasks"
ON public.tasks
FOR SELECT
TO public
USING (public.is_public_board_task(id));

-- SELECT: Admin pode ver tudo
CREATE POLICY "admin_view_all_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- SELECT: Usuários podem ver suas próprias tasks
CREATE POLICY "user_view_own_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
  OR public.user_is_task_participant(auth.uid(), id)
);

-- INSERT: Admin pode criar em qualquer lugar
CREATE POLICY "admin_insert_tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- INSERT: Usuários podem criar tasks em seus boards
CREATE POLICY "user_insert_own_board_tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.user_owns_column_board(auth.uid(), column_id));

-- UPDATE: Admin pode atualizar tudo
CREATE POLICY "admin_update_all_tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- UPDATE: Usuários podem atualizar suas tasks
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

-- DELETE: Admin pode deletar tudo
CREATE POLICY "admin_delete_all_tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- DELETE: Usuários podem deletar tasks que criaram ou tasks em seus boards
CREATE POLICY "user_delete_own_tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
);