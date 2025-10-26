-- Criar view board_ai_view para o chat interno da IA
CREATE OR REPLACE VIEW public.board_ai_view AS
SELECT 
    b.id as board_id,
    b.titulo as board_title,
    b.descricao as board_description,
    b.created_at as board_created_at,
    b.publico as is_public,
    u.nome as owner_name,
    
    -- Agregação de colunas
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'id', c.id,
                'title', c.titulo,
                'position', c.posicao,
                'color', c.cor
            )
        ) FILTER (WHERE c.id IS NOT NULL), 
        '[]'::json
    ) as columns,
    
    -- Agregação de tarefas
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'id', t.id,
                'title', t.titulo,
                'description', t.descricao,
                'priority', t.prioridade,
                'due_date', t.data_entrega,
                'column_id', t.column_id,
                'column_title', c.titulo,
                'responsible', COALESCE(resp.nome, 'Não atribuído'),
                'created_at', t.created_at
            )
        ) FILTER (WHERE t.id IS NOT NULL), 
        '[]'::json
    ) as tasks,
    
    -- Agregação de comentários
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'id', bc.id,
                'author', bc.author_name,
                'content', bc.content,
                'is_public', bc.is_public,
                'created_at', bc.created_at
            )
        ) FILTER (WHERE bc.id IS NOT NULL), 
        '[]'::json
    ) as board_comments,
    
    -- Agregação de mensagens do chat
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'id', bm.id,
                'content', bm.content,
                'sender', bm.sender,
                'created_at', bm.created_at
            )
        ) FILTER (WHERE bm.id IS NOT NULL), 
        '[]'::json
    ) as board_messages,
    
    -- Estatísticas
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT c.id) as total_columns,
    COUNT(DISTINCT bc.id) as total_comments,
    COUNT(DISTINCT bm.id) as total_messages
    
FROM public.boards b
LEFT JOIN public.users u ON b.user_id = u.id
LEFT JOIN public.columns c ON b.id = c.board_id
LEFT JOIN public.tasks t ON c.id = t.column_id
LEFT JOIN public.users resp ON t.responsavel_id = resp.id
LEFT JOIN public.board_comments bc ON b.id = bc.board_id
LEFT JOIN public.board_messages bm ON b.id = bm.board_id
GROUP BY 
    b.id, 
    b.titulo, 
    b.descricao, 
    b.created_at, 
    b.publico, 
    u.nome;

-- Habilitar RLS na view
ALTER VIEW public.board_ai_view SET (security_invoker = true);

-- Criar política para permitir acesso à view
CREATE POLICY "Permitir acesso à board_ai_view" ON public.boards
    FOR SELECT USING (
        publico = true OR 
        (auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.board_id = boards.id
            )
        ))
    );