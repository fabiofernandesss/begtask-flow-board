-- Add created_by field to tasks if it doesn't exist
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update existing tasks to set created_by to board owner
UPDATE public.tasks t
SET created_by = b.owner_id
FROM public.columns col
INNER JOIN public.boards b ON col.board_id = b.id
WHERE t.column_id = col.id AND t.created_by IS NULL;

-- Drop existing problematic policies on tasks
DROP POLICY IF EXISTS "Admin users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view accessible tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in accessible boards" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can delete all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created" ON public.tasks;
DROP POLICY IF EXISTS "Admin can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can create tasks in own boards" ON public.tasks;
DROP POLICY IF EXISTS "Admin can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin can delete all tasks" ON public.tasks;
DROP POLICY IF EXISTS "User can delete own tasks" ON public.tasks;

-- Drop functions if exist
DROP FUNCTION IF EXISTS public.user_can_access_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_can_access_board(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_owns_column_board(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_is_task_participant(uuid, uuid);

-- Create security definer function to check if user owns the board of a column
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

-- Create security definer function to check if user is task participant
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

-- Create new simplified RLS policies for tasks

-- SELECT: Admins see all, users see their tasks or tasks they participate in or tasks in their boards
CREATE POLICY "Admin can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User can view own tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
  OR public.user_is_task_participant(auth.uid(), id)
);

-- INSERT: Admins can insert anywhere, users can insert in their boards
CREATE POLICY "Admin can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User can create tasks in own boards"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_owns_column_board(auth.uid(), column_id)
);

-- UPDATE: Admins can update all, users can update their tasks
CREATE POLICY "Admin can update all tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User can update own tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR responsavel_id = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
  OR public.user_is_task_participant(auth.uid(), id)
);

-- DELETE: Admins can delete all, users can delete tasks they created or in their boards
CREATE POLICY "Admin can delete all tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "User can delete own tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.user_owns_column_board(auth.uid(), column_id)
);