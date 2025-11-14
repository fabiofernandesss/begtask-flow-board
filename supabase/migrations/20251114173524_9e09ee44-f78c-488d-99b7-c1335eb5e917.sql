-- Adicionar policies para permitir que editors gerenciem colunas

-- Editor pode inserir colunas
CREATE POLICY "editor_insert_columns"
ON public.columns
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

-- Editor pode atualizar colunas
CREATE POLICY "editor_update_columns"
ON public.columns
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role));

-- Editor pode deletar colunas que criou
CREATE POLICY "editor_delete_own_columns"
ON public.columns
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role) AND created_by = auth.uid());

-- Owner pode inserir, atualizar e deletar colunas do seu board
CREATE POLICY "owner_insert_columns"
ON public.columns
FOR INSERT
TO authenticated
WITH CHECK (user_owns_column_board(auth.uid(), board_id));

CREATE POLICY "owner_update_columns"
ON public.columns
FOR UPDATE
TO authenticated
USING (user_owns_column_board(auth.uid(), board_id));

CREATE POLICY "owner_delete_columns"
ON public.columns
FOR DELETE
TO authenticated
USING (user_owns_column_board(auth.uid(), board_id));