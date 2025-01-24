/*
  # Add Google OAuth Provider

  1. Changes
    - Enable Google OAuth provider
    - Add Google OAuth settings
*/

-- Enable the Google OAuth provider
CREATE OR REPLACE FUNCTION add_google_provider()
RETURNS void AS $$
BEGIN
  INSERT INTO auth.providers (provider_id, enabled)
  VALUES ('google', true)
  ON CONFLICT (provider_id)
  DO UPDATE SET enabled = true;
END;
$$ LANGUAGE plpgsql;