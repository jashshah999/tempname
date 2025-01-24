/*
  # Make storage bucket public and fix policies

  1. Changes
    - Make excel-files bucket public for viewing
    - Update policies to maintain security while allowing public reads
*/

DO $$
BEGIN
    -- Make bucket public
    UPDATE storage.buckets
    SET public = true
    WHERE id = 'excel-files';

    -- Ensure proper policies for public access
    DROP POLICY IF EXISTS "Allow public viewing of files" ON storage.objects;
    
    CREATE POLICY "Allow public viewing of files"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'excel-files');
END $$;