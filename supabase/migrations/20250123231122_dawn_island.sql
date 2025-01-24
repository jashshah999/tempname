-- First, drop all existing storage policies
DO $$
BEGIN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to view files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can read all files" ON storage.objects;
END $$;

-- Delete existing objects and bucket if they exist
DO $$
BEGIN
    -- First delete all objects in the bucket
    DELETE FROM storage.objects WHERE bucket_id = 'excel-files';
    
    -- Then delete the bucket
    DELETE FROM storage.buckets WHERE id = 'excel-files';
END $$;

-- Create the bucket with proper configuration
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

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create a single comprehensive policy for file management
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