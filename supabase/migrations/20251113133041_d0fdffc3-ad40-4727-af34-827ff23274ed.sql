-- Corrigir recursão infinita nas políticas RLS de tasks
-- Remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Users can create tasks in accessible boards" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks or board owner can delete" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks or board owner can update" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks from accessible boards" ON public.tasks;
DROP POLICY IF EXISTS "Permitir acesso público a tarefas de boards públicos" ON public.tasks;

-- Criar políticas simples sem recursão

-- SELECT: Ver tasks de boards públicos, que são donos, admins, responsáveis ou participantes
CREATE POLICY "Users can view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM columns c
    JOIN boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (
      b.publico = true
      OR b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR tasks.responsavel_id = auth.uid()
      OR tasks.created_by = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1 FROM task_participants tp
    WHERE tp.task_id = tasks.id
    AND tp.user_id = auth.uid()
  )
);

-- SELECT público: acesso anônimo a tasks de boards públicos
CREATE POLICY "Public can view tasks from public boards"
ON public.tasks
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM columns c
    JOIN boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND b.publico = true
  )
);

-- INSERT: Apenas donos do board ou admins podem criar tasks
CREATE POLICY "Users can create tasks in their boards"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM columns c
    JOIN boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND (b.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- UPDATE: Admins podem tudo, donos do board podem tudo, criadores/responsáveis/participantes podem atualizar suas tasks
CREATE POLICY "Users can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM columns c
    JOIN boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND b.owner_id = auth.uid()
  )
  OR tasks.created_by = auth.uid()
  OR tasks.responsavel_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM task_participants tp
    WHERE tp.task_id = tasks.id
    AND tp.user_id = auth.uid()
  )
);

-- DELETE: Apenas admins, donos do board, ou quem criou podem deletar
CREATE POLICY "Users can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM columns c
    JOIN boards b ON b.id = c.board_id
    WHERE c.id = tasks.column_id
    AND b.owner_id = auth.uid()
  )
  OR tasks.created_by = auth.uid()
);

-- Revisar políticas de task_participants para evitar problemas
DROP POLICY IF EXISTS "task_participants_read" ON public.task_participants;
DROP POLICY IF EXISTS "task_participants_write" ON public.task_participants;

-- SELECT: Ver participantes de tasks que têm permissão para ver
CREATE POLICY "Users can view task participants"
ON public.task_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.id = task_participants.task_id
    AND (
      b.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR t.created_by = auth.uid()
      OR t.responsavel_id = auth.uid()
      OR task_participants.user_id = auth.uid()
    )
  )
);

-- INSERT: Admins, donos do board, criadores ou responsáveis podem adicionar participantes
CREATE POLICY "Users can add task participants"
ON public.task_participants
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.id = task_participants.task_id
    AND (
      b.owner_id = auth.uid()
      OR t.created_by = auth.uid()
      OR t.responsavel_id = auth.uid()
    )
  )
);

-- UPDATE: Mesmas regras do INSERT
CREATE POLICY "Users can update task participants"
ON public.task_participants
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.id = task_participants.task_id
    AND (
      b.owner_id = auth.uid()
      OR t.created_by = auth.uid()
      OR t.responsavel_id = auth.uid()
    )
  )
);

-- DELETE: Admins, donos do board, criadores, responsáveis ou o próprio participante podem remover
CREATE POLICY "Users can remove task participants"
ON public.task_participants
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR task_participants.user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.id = task_participants.task_id
    AND (
      b.owner_id = auth.uid()
      OR t.created_by = auth.uid()
      OR t.responsavel_id = auth.uid()
    )
  )
);