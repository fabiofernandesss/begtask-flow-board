-- Update the function to allow users with board access to manage task participants
CREATE OR REPLACE FUNCTION public.user_can_manage_task_participants(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
      OR user_has_board_access(_user_id, b.id)
    )
  )
$$;