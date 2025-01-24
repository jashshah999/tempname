/*
  # Fix storage configuration
  
  1. Storage Configuration
    - Enable storage extension
    - Create excel-files bucket with proper settings
    - Set up proper RLS policies for file access
  2. Security
    - Allow authenticated users to upload files
    - Allow users to read their own files
*/

-- Create bucket for Excel files with proper settings
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'excel-files',
        'excel-files',
        false,
        5242880, -- 5MB limit
        ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
END $$;

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Recreate policies with proper settings
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;

    CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'excel-files' 
        AND (CASE WHEN RIGHT(name, 5) = '.xlsx' THEN true ELSE false END)
    );

    CREATE POLICY "Allow users to read their own files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'excel-files' 
        AND auth.uid() = owner
    );
END $$;