/*
  # Create storage bucket for Excel files
  
  1. New Storage Bucket
    - `excel-files` bucket for storing price lists
  2. Security
    - Enable authenticated users to upload files
    - Enable authenticated users to read their own files
*/

-- Create bucket for Excel files
INSERT INTO storage.buckets (id, name)
VALUES ('excel-files', 'excel-files')
ON CONFLICT DO NOTHING;

-- Set up RLS policies for storage
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'excel-files');

CREATE POLICY "Allow users to read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'excel-files' AND auth.uid() = owner);