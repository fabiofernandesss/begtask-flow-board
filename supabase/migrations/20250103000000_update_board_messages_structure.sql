-- Update board_messages table structure to match the application code
-- Add new columns and rename existing ones

-- First, add the new columns
ALTER TABLE public.board_messages 
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_email TEXT,
ADD COLUMN IF NOT EXISTS sender_type TEXT,
ADD COLUMN IF NOT EXISTS message_content TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Copy data from old columns to new columns if they exist
UPDATE public.board_messages 
SET 
  message_content = content,
  sender_type = sender
WHERE message_content IS NULL OR sender_type IS NULL;

-- Make the new columns NOT NULL after copying data
ALTER TABLE public.board_messages 
ALTER COLUMN message_content SET NOT NULL,
ALTER COLUMN sender_type SET NOT NULL,
ALTER COLUMN sender_name SET NOT NULL,
ALTER COLUMN is_public SET NOT NULL;

-- Drop the old columns
ALTER TABLE public.board_messages 
DROP COLUMN IF EXISTS content,
DROP COLUMN IF EXISTS sender;

-- Update RLS policies to work with new structure
DROP POLICY IF EXISTS "board_messages_public_read" ON public.board_messages;
DROP POLICY IF EXISTS "board_messages_private_read" ON public.board_messages;
DROP POLICY IF EXISTS "board_messages_insert" ON public.board_messages;

-- Create new RLS policies
-- Policy for public messages - anyone can read public messages
CREATE POLICY "board_messages_public_read" ON public.board_messages
  FOR SELECT
  USING (is_public = true);

-- Policy for private messages - only authenticated users can read private messages
CREATE POLICY "board_messages_private_read" ON public.board_messages
  FOR SELECT
  USING (
    is_public = false AND auth.uid() IS NOT NULL
  );

-- Policy for inserting public messages - anyone can insert public messages
CREATE POLICY "board_messages_insert_public" ON public.board_messages
  FOR INSERT
  WITH CHECK (is_public = true);

-- Policy for inserting private messages - only authenticated users can insert private messages
CREATE POLICY "board_messages_insert_private" ON public.board_messages
  FOR INSERT
  WITH CHECK (is_public = false AND auth.uid() IS NOT NULL);

-- Policy for updating messages - only authenticated users can update
CREATE POLICY "board_messages_update" ON public.board_messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Policy for deleting messages - only authenticated users can delete
CREATE POLICY "board_messages_delete" ON public.board_messages
  FOR DELETE
  USING (auth.uid() IS NOT NULL);