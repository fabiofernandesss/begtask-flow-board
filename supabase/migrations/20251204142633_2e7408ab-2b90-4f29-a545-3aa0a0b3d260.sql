-- Adicionar 10 campos de imagem URL na tabela tasks
ALTER TABLE public.tasks 
ADD COLUMN image_url_1 text,
ADD COLUMN image_url_2 text,
ADD COLUMN image_url_3 text,
ADD COLUMN image_url_4 text,
ADD COLUMN image_url_5 text,
ADD COLUMN image_url_6 text,
ADD COLUMN image_url_7 text,
ADD COLUMN image_url_8 text,
ADD COLUMN image_url_9 text,
ADD COLUMN image_url_10 text;

-- Criar bucket para imagens de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket task-images
CREATE POLICY "Qualquer pessoa pode ver imagens de tarefas"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-images');

CREATE POLICY "Usuários autenticados podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-images' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar suas imagens"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-images' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar imagens"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-images' AND auth.role() = 'authenticated');