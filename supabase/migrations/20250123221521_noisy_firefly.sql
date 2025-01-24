/*
  # Update storage bucket configuration

  1. Changes
    - Update existing storage bucket settings
    - Ensure proper file type restrictions
    - Set up secure access policies

  2. Security
    - Maintain RLS policies
    - Update file access controls
    - Enforce file type restrictions
*/

-- Update bucket configuration if it exists, create if it doesn't
DO $$
BEGIN
    UPDATE storage.buckets
    SET 
        public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY[
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/pdf'
        ]
    WHERE id = 'excel-files';

    -- If the update affected no rows, create the bucket
    IF NOT FOUND THEN
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
            5242880,
            ARRAY[
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'application/pdf'
            ]
        );
    END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can read all files" ON storage.objects;
END $$;

-- Create comprehensive policies for file management
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
    AND (
        CASE 
            WHEN RIGHT(name, 5) = '.xlsx' THEN true
            WHEN RIGHT(name, 4) = '.pdf' THEN true
            ELSE false
        END
    )
);

-- Create policy for reading files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'excel-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);