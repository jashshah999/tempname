-- Ensure storage extension is enabled
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "storage";

-- Recreate the bucket with proper configuration
DO $$
BEGIN
    -- Drop existing bucket if it exists
    BEGIN
        DELETE FROM storage.buckets WHERE id = 'excel-files';
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Create bucket with proper settings
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