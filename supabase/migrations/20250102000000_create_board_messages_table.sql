-- Create board_messages table for chat functionality
CREATE TABLE public.board_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_board_messages_board_id ON public.board_messages(board_id);
CREATE INDEX idx_board_messages_created_at ON public.board_messages(created_at);

-- Enable RLS
ALTER TABLE public.board_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for public boards - anyone can read messages
CREATE POLICY "board_messages_public_read" ON public.board_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.boards 
      WHERE id = board_id AND publico = true
    )
  );

-- Policy for private boards - only authenticated users can read messages
CREATE POLICY "board_messages_private_read" ON public.board_messages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.boards 
      WHERE id = board_id AND publico = false
    )
  );

-- Policy for inserting messages - only authenticated users can insert
CREATE POLICY "board_messages_insert" ON public.board_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for updating messages - users can only update their own messages
CREATE POLICY "board_messages_update" ON public.board_messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Policy for deleting messages - users can only delete their own messages
CREATE POLICY "board_messages_delete" ON public.board_messages
  FOR DELETE
  USING (auth.uid() IS NOT NULL);