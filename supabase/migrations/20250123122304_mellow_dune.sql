/*
  # Configure storage for Excel files
  
  1. Storage Configuration
    - Create excel-files bucket
    - Set up proper RLS policies for file access
  2. Security
    - Allow authenticated users to upload files
    - Allow users to read their own files
*/

-- Create bucket for Excel files if it doesn't exist
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('excel-files', 'excel-files', false)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for file access
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;

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
END $$;