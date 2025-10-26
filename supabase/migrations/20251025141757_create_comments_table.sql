-- Criar tabela de comentários para blocos
CREATE TABLE IF NOT EXISTS public.board_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true, -- true para comentários públicos, false para internos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Criar índices para melhor performance
CREATE INDEX idx_board_comments_board_id ON public.board_comments(board_id);
CREATE INDEX idx_board_comments_created_at ON public.board_comments(created_at);
CREATE INDEX idx_board_comments_is_public ON public.board_comments(is_public);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura de comentários públicos por qualquer pessoa
CREATE POLICY "Permitir leitura de comentários públicos" ON public.board_comments
    FOR SELECT USING (is_public = true);

-- Política para permitir inserção de comentários públicos por qualquer pessoa
CREATE POLICY "Permitir inserção de comentários públicos" ON public.board_comments
    FOR INSERT WITH CHECK (is_public = true);

-- Política para permitir leitura de comentários internos apenas para usuários autenticados
CREATE POLICY "Permitir leitura de comentários internos para usuários autenticados" ON public.board_comments
    FOR SELECT USING (
        is_public = false AND 
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_comments.board_id
        )
    );

-- Política para permitir inserção de comentários internos apenas para usuários autenticados
CREATE POLICY "Permitir inserção de comentários internos para usuários autenticados" ON public.board_comments
    FOR INSERT WITH CHECK (
        is_public = false AND 
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_comments.board_id
        )
    );

-- Política para permitir atualização de comentários internos apenas para usuários autenticados
CREATE POLICY "Permitir atualização de comentários internos para usuários autenticados" ON public.board_comments
    FOR UPDATE USING (
        is_public = false AND 
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_comments.board_id
        )
    );

-- Política para permitir exclusão de comentários internos apenas para usuários autenticados
CREATE POLICY "Permitir exclusão de comentários internos para usuários autenticados" ON public.board_comments
    FOR DELETE USING (
        is_public = false AND 
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_comments.board_id
        )
    );

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_board_comments_updated_at 
    BEFORE UPDATE ON public.board_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Criar tabela para vetorização das informações do bloco
CREATE TABLE IF NOT EXISTS public.board_vectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Conteúdo vetorizado (título, descrição, tarefas, etc.)
    embedding vector(1536), -- Vetor de embedding (OpenAI ada-002 tem 1536 dimensões)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Criar índices para a tabela de vetores
CREATE INDEX idx_board_vectors_board_id ON public.board_vectors(board_id);
CREATE INDEX idx_board_vectors_created_at ON public.board_vectors(created_at);

-- Habilitar RLS para a tabela de vetores
ALTER TABLE public.board_vectors ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura de vetores apenas para usuários autenticados do bloco
CREATE POLICY "Permitir leitura de vetores para usuários do bloco" ON public.board_vectors
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_vectors.board_id
        )
    );

-- Política para permitir inserção/atualização de vetores apenas para usuários autenticados do bloco
CREATE POLICY "Permitir inserção de vetores para usuários do bloco" ON public.board_vectors
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_vectors.board_id
        )
    );

CREATE POLICY "Permitir atualização de vetores para usuários do bloco" ON public.board_vectors
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.board_id = board_vectors.board_id
        )
    );

-- Trigger para atualizar updated_at na tabela de vetores
CREATE TRIGGER update_board_vectors_updated_at 
    BEFORE UPDATE ON public.board_vectors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();