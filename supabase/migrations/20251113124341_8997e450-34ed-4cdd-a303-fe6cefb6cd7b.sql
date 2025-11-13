-- Adicionar campo created_by nas tabelas columns e tasks
ALTER TABLE public.columns ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Atualizar registros existentes para definir created_by baseado no owner do board
UPDATE public.columns 
SET created_by = (SELECT owner_id FROM public.boards WHERE boards.id = columns.board_id)
WHERE created_by IS NULL;

UPDATE public.tasks 
SET created_by = (
  SELECT b.owner_id 
  FROM public.boards b
  JOIN public.columns c ON c.board_id = b.id
  WHERE c.id = tasks.column_id
)
WHERE created_by IS NULL;

-- Remover policies antigas e criar novas para columns
DROP POLICY IF EXISTS "Users can manage columns in their boards" ON public.columns;
DROP POLICY IF EXISTS "Active users can view columns from their boards" ON public.columns;

-- Policy para visualizar colunas (boards públicos ou onde o usuário participa)
CREATE POLICY "Users can view columns from accessible boards"
ON public.columns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id
    AND (
      b.publico = true
      OR b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.column_id IN (
          SELECT c.id FROM public.columns c WHERE c.board_id = b.id
        )
        AND (
          t.responsavel_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.task_participants tp
            WHERE tp.task_id = t.id AND tp.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Policy para criar colunas
CREATE POLICY "Users can create columns in accessible boards"
ON public.columns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id
    AND (
      b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.column_id IN (
          SELECT c.id FROM public.columns c WHERE c.board_id = b.id
        )
        AND (
          t.responsavel_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.task_participants tp
            WHERE tp.task_id = t.id AND tp.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Policy para atualizar colunas
CREATE POLICY "Users can update their own columns or board owner can update"
ON public.columns
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Policy para deletar colunas
CREATE POLICY "Users can delete their own columns or board owner can delete"
ON public.columns
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Remover policies antigas e criar novas para tasks
DROP POLICY IF EXISTS "Active users can manage tasks in their boards" ON public.tasks;
DROP POLICY IF EXISTS "Active users can view tasks from their boards" ON public.tasks;

-- Policy para visualizar tarefas
CREATE POLICY "Users can view tasks from accessible boards"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.columns c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (
      b.publico = true
      OR b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR tasks.responsavel_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.task_participants tp
        WHERE tp.task_id = tasks.id AND tp.user_id = auth.uid()
      )
    )
  )
);

-- Policy para criar tarefas
CREATE POLICY "Users can create tasks in accessible boards"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.columns c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (
      b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.column_id IN (
          SELECT col.id FROM public.columns col WHERE col.board_id = b.id
        )
        AND (
          t.responsavel_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.task_participants tp
            WHERE tp.task_id = t.id AND tp.user_id = auth.uid()
          )
        )
      )
    )
  )
);

-- Policy para atualizar tarefas
CREATE POLICY "Users can update their own tasks or board owner can update"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.columns c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
  OR EXISTS (
    SELECT 1 FROM public.task_participants tp
    WHERE tp.task_id = tasks.id AND tp.user_id = auth.uid()
  )
);

-- Policy para deletar tarefas
CREATE POLICY "Users can delete their own tasks or board owner can delete"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.columns c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);