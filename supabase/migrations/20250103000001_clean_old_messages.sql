-- Limpar mensagens antigas da tabela board_messages
-- Isso vai remover todas as mensagens existentes para começar com um chat limpo

DELETE FROM public.board_messages;

-- Resetar a sequência do ID para começar do 1 novamente
ALTER SEQUENCE board_messages_id_seq RESTART WITH 1;