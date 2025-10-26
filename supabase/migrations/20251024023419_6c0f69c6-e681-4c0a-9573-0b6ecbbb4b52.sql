-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;

-- Create comprehensive policies for avatars bucket
CREATE POLICY "Public avatars are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload to avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can delete from avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');