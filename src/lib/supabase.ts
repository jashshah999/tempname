import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallback for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please connect to Supabase using the "Connect to Supabase" button in the top right corner.'
  );
}

// Create Supabase client with error handling
export const supabase = createClient(
  supabaseUrl || 'http://placeholder-url',
  supabaseAnonKey || 'placeholder-key'
);

// Add type safety for auth response
export type AuthResponse = {
  user: {
    id: string;
    email?: string;
  } | null;
  error: Error | null;
};