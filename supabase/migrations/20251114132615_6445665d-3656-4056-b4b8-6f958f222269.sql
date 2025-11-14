-- Passo 2: Atualizar políticas RLS para os três tipos de usuário

-- Remover políticas antigas de boards
DROP POLICY IF EXISTS "Active users can create boards" ON public.boards;
DROP POLICY IF EXISTS "Active users can view all boards" ON public.boards;
DROP POLICY IF EXISTS "Users can update their own boards" ON public.boards;
DROP POLICY IF EXISTS "Users can delete their own boards" ON public.boards;

-- Criar novas políticas para boards
-- Admins podem fazer tudo
CREATE POLICY "admin_full_access_boards"
ON public.boards
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Editores e visualizadores podem ver boards
CREATE POLICY "editor_visualizador_view_boards"
ON public.boards
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'editor') 
  OR public.has_role(auth.uid(), 'visualizador')
  OR owner_id = auth.uid()
);

-- Remover políticas antigas de columns
DROP POLICY IF EXISTS "Users can insert columns in their boards" ON public.columns;
DROP POLICY IF EXISTS "Users can update their own columns or board owner can update" ON public.columns;
DROP POLICY IF EXISTS "Users can delete their own columns or board owner can delete" ON public.columns;

-- Criar novas políticas para columns
-- Admins podem fazer tudo
CREATE POLICY "admin_full_access_columns"
ON public.columns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Editores e visualizadores podem ver colunas
CREATE POLICY "editor_visualizador_view_columns"
ON public.columns
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'editor') 
  OR public.has_role(auth.uid(), 'visualizador')
  OR user_owns_column_board(auth.uid(), id)
);

-- Remover políticas antigas de tasks
DROP POLICY IF EXISTS "admin_view_all_tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin_update_all_tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin_delete_all_tasks" ON public.tasks;
DROP POLICY IF EXISTS "user_view_own_tasks" ON public.tasks;
DROP POLICY IF EXISTS "user_insert_board_tasks" ON public.tasks;
DROP POLICY IF EXISTS "user_update_own_tasks" ON public.tasks;
DROP POLICY IF EXISTS "user_delete_own_created_tasks" ON public.tasks;

-- Criar novas políticas para tasks
-- Admins podem fazer tudo
CREATE POLICY "admin_full_access_tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Editores podem ver todas as tarefas
CREATE POLICY "editor_view_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'editor'));

-- Editores podem criar tarefas
CREATE POLICY "editor_insert_tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'editor'));

-- Editores podem atualizar tarefas
CREATE POLICY "editor_update_tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'editor'));

-- Editores podem deletar APENAS tarefas que eles criaram
CREATE POLICY "editor_delete_own_tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'editor') 
  AND created_by = auth.uid()
);

-- Visualizadores podem apenas ver tarefas
CREATE POLICY "visualizador_view_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'visualizador'));

-- Owners podem continuar fazendo tudo em suas próprias tarefas
CREATE POLICY "owner_view_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR user_owns_column_board(auth.uid(), column_id)
  OR user_is_task_participant(auth.uid(), id)
);

CREATE POLICY "owner_insert_tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (user_owns_column_board(auth.uid(), column_id));

CREATE POLICY "owner_update_tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR user_owns_column_board(auth.uid(), column_id)
  OR user_is_task_participant(auth.uid(), id)
);

CREATE POLICY "owner_delete_tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR user_owns_column_board(auth.uid(), column_id)
);