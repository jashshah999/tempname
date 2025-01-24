/*
  # Add PDF support to storage bucket

  1. Changes
    - Update excel-files bucket to support PDF mime type
    - Update storage policies to allow PDF uploads
    - Keep existing Excel file support

  2. Security
    - Maintain existing RLS policies
    - Only allow authenticated users to upload and access files
*/

DO $$
BEGIN
    -- Update bucket configuration to include PDF mime type
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf'
    ]
    WHERE id = 'excel-files';

    -- Drop existing upload policy
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;

    -- Create new policy that allows both Excel and PDF files
    CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'excel-files' 
        AND (
            CASE 
                WHEN RIGHT(name, 5) = '.xlsx' THEN true
                WHEN RIGHT(name, 4) = '.pdf' THEN true
                ELSE false
            END
        )
    );
END $$;