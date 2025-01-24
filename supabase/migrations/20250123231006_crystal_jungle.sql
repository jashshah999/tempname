-- Drop existing bucket if it exists
DROP EXTENSION IF EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recreate the bucket with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'excel-files',
    'excel-files',
    false,
    5242880, -- 5MB limit
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf'
    ]
) ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
END $$;

-- Create comprehensive policy for file management
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