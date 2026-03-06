
CREATE OR REPLACE FUNCTION public.hash_board_password(_password text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN extensions.crypt(_password, extensions.gen_salt('bf'));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_board_password(_board_id uuid, _password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = _board_id
    AND senha_hash = extensions.crypt(_password, senha_hash)
  );
END;
$$;
