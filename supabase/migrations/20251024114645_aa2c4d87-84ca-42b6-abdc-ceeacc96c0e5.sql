-- Adiciona campo de cor nas colunas
ALTER TABLE columns ADD COLUMN IF NOT EXISTS cor text DEFAULT '#6366f1';