-- Drop existing policies to ensure clean slate
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to view files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
END $$;

-- Create comprehensive policies for all operations
CREATE POLICY "Users can manage their own files"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Add public read access for authenticated users
CREATE POLICY "Authenticated users can read all files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'excel-files');