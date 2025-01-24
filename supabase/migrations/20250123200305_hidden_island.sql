/*
  # Fix file visibility for user-specific access

  1. Changes
    - Update storage bucket to be private
    - Remove public access policy
    - Add user-specific policies for file access
    - Add folder structure for user-specific files

  2. Security
    - Enable RLS for storage bucket
    - Add policies to ensure users can only access their own files
    - Remove public access to files
*/

-- Make bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'excel-files';

-- Remove any existing policies
DROP POLICY IF EXISTS "Allow public viewing of files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;

-- Create new policies for user-specific access
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);