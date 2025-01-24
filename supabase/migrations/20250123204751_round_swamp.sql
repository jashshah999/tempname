/*
  # Fix PDF viewing access

  1. Changes
    - Make bucket public for viewing
    - Keep user-specific upload/delete restrictions
    - Update policies for proper file access
  
  2. Security
    - Maintain RLS
    - Keep user-specific upload/delete controls
    - Allow public viewing for authenticated users
*/

-- Update bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'excel-files';

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public viewing of files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
END $$;

-- Create updated policies
CREATE POLICY "Allow authenticated users to view files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'excel-files');

CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
        CASE 
            WHEN RIGHT(name, 5) = '.xlsx' THEN true
            WHEN RIGHT(name, 4) = '.pdf' THEN true
            ELSE false
        END
    )
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);