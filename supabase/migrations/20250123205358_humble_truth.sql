-- Add UPDATE policy for storage objects
DO $$
BEGIN
    -- Drop existing update policy if it exists
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

    -- Create policy for updating files
    CREATE POLICY "Users can update their own files"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'excel-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'excel-files'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;