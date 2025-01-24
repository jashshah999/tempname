/*
  # Fix storage bucket configuration

  1. Changes
    - Recreate excel-files bucket with proper configuration
    - Update storage policies for proper file access
    - Add proper MIME type configurations
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Recreate the bucket with proper settings
DO $$
BEGIN
    -- Drop existing bucket if it exists
    BEGIN
        DELETE FROM storage.buckets WHERE id = 'excel-files';
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Create bucket with proper configuration
    INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    ) VALUES (
        'excel-files',
        'excel-files',
        false,
        5242880, -- 5MB limit
        ARRAY[
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/pdf'
        ]
    );
END $$;

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public viewing of files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
END $$;

-- Create proper policies for user-specific access
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